import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import { fetchReturns, createRma, transitionRma, generateReturnLabel, labelUrl, type RmaReturn } from './api/returns';

const ACTIONS = ['review', 'approve', 'reject', 'schedule_pickup', 'mark_collected', 'complete_qc', 'process_refund', 'complete'];

export default function Returns() {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const canWrite = hasPermission(perms, 'returns:write');

  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [actionFor, setActionFor] = useState<{ id: string; action: string }>({ id: '', action: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-returns'],
    queryFn: () => fetchReturns({ page: 1, limit: 20 }),
  });

  const createMut = useMutation({
    mutationFn: () => createRma({ orderId, reason }),
    onSuccess: () => { toast.success('RMA opened'); qc.invalidateQueries({ queryKey: ['admin-returns'] }); setOrderId(''); setReason(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const transitionMut = useMutation({
    mutationFn: ({ id, action, qcOutcome }: { id: string; action: string; qcOutcome?: string }) =>
      transitionRma(id, action, action === 'complete_qc' ? { qcOutcome } : {}),
    onSuccess: () => { toast.success('RMA updated'); qc.invalidateQueries({ queryKey: ['admin-returns'] }); setActionFor({ id: '', action: '' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const labelMut = useMutation({
    mutationFn: (id: string) => generateReturnLabel(id),
    onSuccess: () => { toast.success('Return label generated'); qc.invalidateQueries({ queryKey: ['admin-returns'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const returns: RmaReturn[] = data?.returns || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Returns (RMA)</h1>

      {canWrite && (
        <div className="bg-black rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !orderId} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Open RMA</button>
        </div>
      )}

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-white/10">
              <tr>
                <th className="text-left p-3">RMA</th>
                <th className="text-left p-3">Order</th>
                <th className="text-right p-3">Refund</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-3 text-gray-200">{r.rma_number}</td>
                  <td className="p-3 text-gray-300">{r.order?.order_number || r.order_id.slice(0, 8)}</td>
                  <td className="p-3 text-right text-gray-300">₦{Number(r.refund_amount || 0).toFixed(2)}</td>
                  <td className="p-3 text-gray-400">{r.status.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-right">
                    {canWrite && (
                      <>
                        <button onClick={() => labelMut.mutate(r.id)} className="text-nova-500 hover:underline mr-2">Label</button>
                        <button
                          onClick={() => setActionFor({ id: r.id, action: '' })}
                          className="text-indigo-400 hover:underline"
                        >
                          Advance
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionFor.id && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-white">Advance RMA</h2>
            <select
              value={actionFor.action}
              onChange={(e) => setActionFor((s) => ({ ...s, action: e.target.value }))}
              className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none"
            >
              <option value="">Select action…</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {actionFor.action === 'complete_qc' && (
              <select
                onChange={(e) => (actionFor as any).qcOutcome = e.target.value}
                className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none"
              >
                <option value="">QC outcome…</option>
                <option value="sellable">sellable</option>
                <option value="damaged">damaged</option>
                <option value="quarantine">quarantine</option>
                <option value="discard">discard</option>
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionFor({ id: '', action: '' })} className="px-4 py-2 rounded-lg text-gray-300">Cancel</button>
              <button
                onClick={() => transitionMut.mutate({ id: actionFor.id, action: actionFor.action, qcOutcome: (actionFor as any).qcOutcome })}
                disabled={!actionFor.action || transitionMut.isPending}
                className="px-4 py-2 rounded-lg bg-indigo-500 text-white disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
