import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import { fetchDisputes, createDispute, escalateDispute, resolveDispute, type Dispute } from './api/disputes';

const statusColor = (s: string) => {
  if (s === 'resolved' || s === 'closed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s === 'escalated') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (s === 'awaiting_evidence') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

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
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-white/10">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">SLA Due</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="p-3 text-gray-300">{d.order?.order_number || d.order_id.slice(0, 8)}</td>
                  <td className="p-3 text-gray-300">{d.subject}</td>
                  <td className="p-3 text-gray-400">{d.priority}</td>
                  <td className={`p-3 ${d.sla_due_at && new Date(d.sla_due_at) < new Date() ? 'text-red-400' : 'text-gray-400'}`}>
                    {d.sla_due_at ? new Date(d.sla_due_at).toLocaleString() : '—'}
                  </td>
                  <td className="p-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs border ${statusColor(d.status)}`}>{d.status.replace(/_/g, ' ')}</span></td>
                  <td className="p-3 text-right">
                    {canResolve && !['resolved', 'closed', 'escalated'].includes(d.status) && (
                      <>
                        <button onClick={() => escalateMut.mutate(d.id)} className="text-orange-400 hover:underline mr-2">Escalate</button>
                        <button onClick={() => setResolveId(d.id)} className="text-emerald-400 hover:underline">Resolve</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
