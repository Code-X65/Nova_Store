import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRiders,
  deleteRider,
  approveRider,
  suspendRider,
  reactivateRider,
  type Rider
} from './api/riders';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';
import {
  PlusIcon, TrashIcon, PencilIcon, CheckIcon, PauseIcon, PlayIcon, UserGroupIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import RiderForm from './RiderForm';
import PendingRidersModal from './PendingRidersModal';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';

const columnHelper = createColumnHelper<Rider>();

type FormMode = { type: 'create' } | { type: 'edit'; rider: Rider };

export default function RidersList() {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const canWrite = hasPermission(perms, 'rider:write');
  const canApprove = hasPermission(perms, 'rider:approve');
  const canSuspend = hasPermission(perms, 'rider:suspend');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rider | null>(null);
  const [showPending, setShowPending] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-riders', { page, search, status: statusFilter }],
    queryFn: () => fetchRiders({ page, limit: 10, search: search || undefined, status: statusFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRider(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-riders'] });
      const previous = qc.getQueryData<any>(['admin-riders']);
      if (previous) {
        qc.setQueryData(['admin-riders'], {
          ...previous,
          riders: previous.riders.filter((r: Rider) => r.id !== id),
          total: Math.max(0, (previous.total || 0) - 1),
        });
      }
      return { previous };
    },
    onSuccess: () => {
      toast.success('Rider removed');
    },
    onError: (err: any, variables, context) => {
      if (context?.previous) {
        qc.setQueryData(['admin-riders'], context.previous);
      }
      toast.error(err?.response?.data?.message || 'Failed to remove rider');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      qc.invalidateQueries({ queryKey: ['admin-riders-active'] });
      qc.invalidateQueries({ queryKey: ['pending-riders'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRider(id),
    onSuccess: () => {
      toast.success('Rider approved');
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      qc.invalidateQueries({ queryKey: ['admin-riders-active'] });
      qc.invalidateQueries({ queryKey: ['pending-riders'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve rider'),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => {
      const rider = data?.riders?.find((r: Rider) => r.id === id);
      if (rider?.status === 'suspended') {
        return reactivateRider(id);
      }
      return suspendRider(id);
    },
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      qc.invalidateQueries({ queryKey: ['admin-riders-active'] });
      qc.invalidateQueries({ queryKey: ['pending-riders'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update status'),
  });

  const columns = useMemo(() => [
    columnHelper.accessor('first_name', {
      header: 'Name',
      cell: (info) => {
        const rider = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-nova-500/10 flex items-center justify-center text-xs font-bold text-nova-400 flex-shrink-0">
              {rider.first_name?.[0]}{rider.last_name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {rider.first_name} {rider.last_name}
              </p>
              <p className="text-xs text-[var(--neu-text)] truncate">{rider.email || rider.phone}</p>
            </div>
          </div>
        );
      },
      size: 220,
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: (info) => <span className="text-gray-300 text-sm">{info.getValue()}</span>,
      size: 150,
    }),
    columnHelper.accessor('vehicle_type', {
      header: 'Vehicle',
      cell: (info) => (
        <span className="text-gray-400 text-sm capitalize">
          {info.getValue()?.replace('_', ' ') || 'None'}
        </span>
      ),
      size: 120,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue();
        const isActive = info.row.original.is_active;
        const label = status === 'live' ? 'LIVE' : status === 'suspended' ? 'SUSPENDED' : 'PENDING';
        const style =
          status === 'live'
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : status === 'suspended'
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        const sub = status === 'live' && !isActive ? ' (inactive)' : '';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${style}`}>
            {label}{sub}
          </span>
        );
      },
      size: 120,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        if (!canWrite && !canApprove && !canSuspend) return null;
        const rider = info.row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            {canApprove && rider.status === 'pending_approval' && (
              <button
                onClick={(e) => { e.stopPropagation(); approveMutation.mutate(rider.id); }}
                disabled={approveMutation.isPending}
                className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-40"
                title="Approve rider"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
            )}
            {canSuspend && (
              <button
                onClick={(e) => { e.stopPropagation(); suspendMutation.mutate(rider.id); }}
                disabled={suspendMutation.isPending}
                className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-40"
                title={rider.status === 'suspended' ? 'Reactivate rider' : 'Suspend rider'}
              >
                {rider.status === 'suspended' ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
              </button>
            )}
            {canWrite && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setFormMode({ type: 'edit', rider }); }}
                  className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Edit rider"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(rider); }}
                  className="p-1.5 text-[var(--neu-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Remove rider"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
      size: 120,
    }),
  ], [canWrite, canApprove, canSuspend, approveMutation, suspendMutation]);

  const riders = data?.riders || [];
  const isEmpty = !isLoading && !isError && riders.length === 0;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">Riders</h1>
          {canApprove && (
            <button
              onClick={() => setShowPending(true)}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-xs font-bold"
            >
              <UserGroupIcon className="w-4 h-4" />
              Pending
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-black border border-gray-800 text-gray-300 text-sm rounded-lg p-2.5 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="live">Live</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="suspended">Suspended</option>
          </select>
          <input
            type="text"
            placeholder="Search riders..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-black border border-gray-800 text-gray-300 text-sm rounded-lg focus:ring-nova-500 focus:border-nova-500 block w-full p-2.5 outline-none transition-colors"
          />
          {canWrite && (
            <button
              onClick={() => setFormMode({ type: 'create' })}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Enroll Rider
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-black rounded-xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-3">
            <p className="text-base font-medium">Failed to load riders</p>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['admin-riders'] })}
              className="btn-secondary text-sm"
            >
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <PlusIcon className="w-6 h-6 text-[var(--neu-text)] opacity-50" />
            </div>
            <p className="text-base font-medium text-white">No riders enrolled yet</p>
            <p className="text-sm text-[var(--neu-text)] mt-1">
              Enroll delivery personnel to start assigning orders.
            </p>
            {canWrite && (
              <button
                onClick={() => setFormMode({ type: 'create' })}
                className="btn-primary mt-4 text-sm"
              >
                Enroll First Rider
              </button>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={riders}
            onRowClick={(row) => {
              if (canWrite) {
                setFormMode({ type: 'edit', rider: row });
              }
            }}
          />
        )}
      </div>

      {formMode && (
        <RiderForm
          mode={formMode}
          onClose={() => setFormMode(null)}
        />
      )}

      {showPending && (
        <PendingRidersModal onClose={() => setShowPending(false)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-md glass-card p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <TrashIcon className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Remove Rider</h3>
                <p className="text-sm text-[var(--neu-text)]">
                  {deleteTarget.first_name} {deleteTarget.last_name}
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--neu-text)]">
              This will permanently remove this rider from the roster. Orders already assigned to this rider will retain the historical record but will not be auto-reassigned.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                disabled={deleteMutation.isPending}
                className="btn-danger text-sm px-5 py-2 disabled:opacity-40"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
