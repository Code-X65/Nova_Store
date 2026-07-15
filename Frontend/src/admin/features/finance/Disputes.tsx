import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import { fetchDisputes, createDispute, escalateDispute, resolveDispute, type Dispute } from './api/disputes';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

const statusColor = (s: string) => {
  if (s === 'resolved' || s === 'closed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s === 'escalated') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (s === 'awaiting_evidence') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

const columnHelper = createColumnHelper<Dispute>();

export default function Disputes() {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const canResolve = hasPermission(perms, 'disputes:resolve') || hasPermission(perms, 'finance:approve');

  const [orderId, setOrderId] = useState('');
  const [subject, setSubject] = useState('');
  const [breaching, setBreaching] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes', { breaching }],
    queryFn: () => fetchDisputes({ page: 1, limit: 20, breaching }),
  });

  const createMut = useMutation({
    mutationFn: () => createDispute({ orderId, subject }),
    onSuccess: () => { toast.success('Dispute opened'); qc.invalidateQueries({ queryKey: ['admin-disputes'] }); setOrderId(''); setSubject(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const escalateMut = useMutation({
    mutationFn: (id: string) => escalateDispute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-disputes'] }),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) => resolveDispute(id, { resolution, status: 'resolved' }),
    onSuccess: () => { toast.success('Dispute resolved'); qc.invalidateQueries({ queryKey: ['admin-disputes'] }); setResolveId(null); setResolution(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const disputes: Dispute[] = data?.disputes || [];

  const columns = React.useMemo(() => [
    columnHelper.accessor((d) => d.order?.order_number || d.order_id.slice(0, 8), {
      id: 'order',
      header: 'Order',
      cell: (info) => <span className="text-gray-300">{info.getValue()}</span>,
    }),
    columnHelper.accessor('subject', {
      header: 'Subject',
      cell: (info) => <span className="text-gray-300">{info.getValue()}</span>,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => <span className="text-gray-400">{info.getValue()}</span>,
    }),
    columnHelper.accessor('sla_due_at', {
      header: 'SLA Due',
      cell: (info) => {
        const d = info.row.original;
        return (
          <span className={d.sla_due_at && new Date(d.sla_due_at) < new Date() ? 'text-red-400' : 'text-gray-400'}>
            {d.sla_due_at ? new Date(d.sla_due_at).toLocaleString() : '—'}
          </span>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${statusColor(info.getValue())}`}>
          {info.getValue().replace(/_/g, ' ')}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const d = info.row.original;
        if (!canResolve || ['resolved', 'closed', 'escalated'].includes(d.status)) return null;
        return (
          <div className="text-right">
            <button onClick={() => escalateMut.mutate(d.id)} className="text-orange-400 hover:underline mr-2">Escalate</button>
            <button onClick={() => setResolveId(d.id)} className="text-emerald-400 hover:underline">Resolve</button>
          </div>
        );
      },
    }),
  ], [canResolve, escalateMut]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">Disputes</h1>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={breaching} onChange={(e) => setBreaching(e.target.checked)} />
          SLA breaching only
        </label>
      </div>

      <div className="bg-black rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !orderId || !subject} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Open Dispute</button>
      </div>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <DataTable columns={columns} data={disputes} />
        )}
      </div>

      {resolveId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">Resolve Dispute</h2>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution notes…" className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none h-24" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setResolveId(null)} className="px-4 py-2 rounded-lg text-gray-300">Cancel</button>
              <button
                onClick={() => resolveMut.mutate({ id: resolveId, resolution })}
                disabled={resolveMut.isPending}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
