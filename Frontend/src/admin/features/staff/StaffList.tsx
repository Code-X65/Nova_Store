import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function StaffList() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-staff', page],
    queryFn: async () => {
      // The endpoint is GET /api/v1/admin/
      const { data } = await api.get('/admin', {
        params: { page, limit: 20 }
      });
      return data.data; // { admins }
    }
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/${id}`);
    },
    onSuccess: () => {
      toast.success('Admin access revoked');
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: () => toast.error('Failed to revoke access')
  });

  const admins = response?.admins || [];

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Staff Member',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-white">{row.original.user?.first_name} {row.original.user?.last_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.user?.email}</div>
        </div>
      )
    },
    {
      accessorKey: 'role',
      header: 'Primary Role',
      cell: ({ row }) => {
        const roles = row.original.roles || [];
        const primaryRole = roles[0]?.role_name || 'No Role';
        return <span className="px-2 py-1 bg-surface-2 rounded text-xs font-semibold uppercase text-nova-400">{primaryRole}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.status === 'active';
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${isActive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
            {isActive ? 'Active' : 'Suspended'}
          </span>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Added On',
      cell: (info) => <span className="text-muted-foreground">{format(new Date(info.getValue() as string), 'MMM d, yyyy')}</span>
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              if (confirm('Revoke access for this staff member?')) {
                revokeMutation.mutate(row.original.id);
              }
            }}
            className="p-1.5 text-muted-foreground hover:text-danger rounded-md hover:bg-danger/10"
            title="Revoke Admin Access"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members and their administrative access.</p>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
        <div className="h-[600px] group-hover-visible">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">Loading...</div>
          ) : (
            <DataTable data={admins} columns={columns} pageSize={15} />
          )}
        </div>
      </div>
    </div>
  );
}