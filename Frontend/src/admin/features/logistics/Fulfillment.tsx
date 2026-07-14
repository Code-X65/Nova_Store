import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import {
  fetchProviders, createProvider, createShipment, fetchShipments,
  type FulfillmentProvider, type FulfillmentShipment,
} from './api/fulfillment';

export default function Fulfillment() {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const canWrite = hasPermission(perms, 'fulfillment:write');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [adapter, setAdapter] = useState('local');
  const [orderId, setOrderId] = useState('');
  const [providerId, setProviderId] = useState('');

  const { data: providers, isLoading: lp } = useQuery({ queryKey: ['admin-providers'], queryFn: fetchProviders });
  const { data: shipments, isLoading: ls } = useQuery({ queryKey: ['admin-shipments'], queryFn: () => fetchShipments({ page: 1, limit: 20 }) });

  const createProviderMut = useMutation({
    mutationFn: () => createProvider({ name, code, adapter }),
    onSuccess: () => { toast.success('Provider added'); qc.invalidateQueries({ queryKey: ['admin-providers'] }); setName(''); setCode(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const createShipmentMut = useMutation({
    mutationFn: () => createShipment({ orderId, providerId }),
    onSuccess: () => { toast.success('Shipment created'); qc.invalidateQueries({ queryKey: ['admin-shipments'] }); setOrderId(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const provs: FulfillmentProvider[] = providers || [];
  const ships: FulfillmentShipment[] = shipments?.shipments || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">3PL & Fulfillment</h1>

      {canWrite && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-black rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-white">Add Provider</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. ShipBob)" className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. shipbob)" className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
            <select value={adapter} onChange={(e) => setAdapter(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none">
              <option value="local">local</option>
              <option value="shipbob">shipbob</option>
              <option value="fegex">fegex</option>
            </select>
            <button onClick={() => createProviderMut.mutate()} disabled={createProviderMut.isPending || !name || !code} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Add Provider</button>
          </div>

          <div className="bg-black rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-white">Create Shipment</h2>
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID" className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none">
              <option value="">Select provider…</option>
              {provs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => createShipmentMut.mutate()} disabled={createShipmentMut.isPending || !orderId || !providerId} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Create Shipment</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-black rounded-xl overflow-hidden">
          <h2 className="p-4 font-semibold text-white">Providers</h2>
          {lp ? <div className="p-4 text-gray-400">Loading…</div> : (
            <table className="w-full text-sm">
              <tbody>
                {provs.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="p-3 text-gray-200">{p.name}</td>
                    <td className="p-3 text-gray-400">{p.code}</td>
                    <td className="p-3 text-gray-400">{p.adapter}</td>
                    <td className="p-3 text-right">{p.is_enabled ? <span className="text-emerald-400">enabled</span> : <span className="text-gray-500">disabled</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-black rounded-xl overflow-hidden">
          <h2 className="p-4 font-semibold text-white">Shipments</h2>
          {ls ? <div className="p-4 text-gray-400">Loading…</div> : (
            <table className="w-full text-sm">
              <tbody>
                {ships.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="p-3 text-gray-200">{s.provider?.name || s.provider_id.slice(0, 8)}</td>
                    <td className="p-3 text-gray-400">{s.tracking_number || '—'}</td>
                    <td className="p-3 text-gray-400">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
