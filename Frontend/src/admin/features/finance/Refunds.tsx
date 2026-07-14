import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import { fetchRefunds, createRefund, processRefund, cancelRefund, type Refund } from './api/refunds';

const statusColor = (s: string) => {
  if (s === 'completed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s === 'failed') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (s === 'pending') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

function money(n: number) {
  return `₦${Number(n || 0).toFixed(2)}`;
}

export default function Refunds() {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-refunds'],
    queryFn: () => fetchRefunds({ page: 1, limit: 20 }),
  });

  const createMut = useMutation({
    mutationFn: () => createRefund({ orderId, amount: Number(amount), reason }),
    onSuccess: () => {
      toast.success('Refund request created (pending approval)');
      qc.invalidateQueries({ queryKey: ['admin-refunds'] });
      setOrderId(''); setAmount(''); setReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create refund'),
  });

  const processMut = useMutation({
    mutationFn: (id: string) => processRefund(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-refunds'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Refund processing failed'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelRefund(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-refunds'] }),
  });

  const refunds: Refund[] = data?.refunds || [];
  const canWrite = hasPermission(perms, 'finance:write');
  const canApprove = hasPermission(perms, 'finance:approve');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Refunds</h1>

      {canWrite && (
        <div className="bg-black rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₦)" type="number" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !orderId || !amount} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">
            Create Refund
          </button>
        </div>
      )}

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-white/10">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Gateway Ref</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-3 text-gray-300">{r.order?.order_number || r.order_id.slice(0, 8)}</td>
                  <td className="p-3 text-right text-gray-300">{money(r.amount)}</td>
                  <td className="p-3 text-gray-400">{r.method}</td>
                  <td className="p-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs border ${statusColor(r.status)}`}>{r.status}</span></td>
                  <td className="p-3 text-gray-400">{r.gateway_reference || '—'}</td>
                  <td className="p-3 text-right">
                    {canApprove && r.status === 'pending' && (
                      <button onClick={() => processMut.mutate(r.id)} disabled={processMut.isPending} className="text-emerald-400 hover:underline mr-2">Process</button>
                    )}
                    {canApprove && ['pending', 'failed'].includes(r.status) && (
                      <button onClick={() => cancelMut.mutate(r.id)} className="text-red-400 hover:underline">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
