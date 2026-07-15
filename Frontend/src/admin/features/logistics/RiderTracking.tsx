import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';
import { pingLocation, fetchLatestLocation, fetchOrderRoute, type LocationPing } from './api/riderTracking';

const columnHelper = createColumnHelper<LocationPing>();

export default function RiderTracking() {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const canWrite = hasPermission(perms, 'logistics:write') || hasPermission(perms, 'rider:write');

  const [riderId, setRiderId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const latest = useQuery({
    queryKey: ['rider-latest', riderId],
    queryFn: () => fetchLatestLocation(riderId),
    enabled: !!riderId,
  });

  const route = useQuery({
    queryKey: ['rider-route', orderId],
    queryFn: () => fetchOrderRoute(orderId),
    enabled: !!orderId,
  });

  const pingMut = useMutation({
    mutationFn: () => pingLocation({ riderId, orderId: orderId || undefined, lat: Number(lat), lng: Number(lng) }),
    onSuccess: () => { toast.success('Ping recorded'); qc.invalidateQueries({ queryKey: ['rider-latest', riderId] }); qc.invalidateQueries({ queryKey: ['rider-route', orderId] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const loc: LocationPing | null = latest.data || null;
  const pings: LocationPing[] = route.data || [];

  const routeColumns = useMemo(() => [
    columnHelper.display({
      id: 'location',
      header: 'Location',
      cell: (info) => <span className="text-gray-300">{info.row.original.lat}, {info.row.original.lng}</span>,
    }),
    columnHelper.accessor('heading', {
      header: 'Heading',
      cell: (info) => <span className="text-gray-400">{info.getValue() != null ? `${info.getValue()}°` : '—'}</span>,
    }),
    columnHelper.accessor('captured_at', {
      header: 'Time',
      cell: (info) => <span className="text-gray-500">{new Date(info.getValue()).toLocaleTimeString()}</span>,
    }),
  ], []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Rider Tracking</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-black rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-white">Live Location Ping</h2>
          <input value={riderId} onChange={(e) => setRiderId(e.target.value)} placeholder="Rider ID" className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID (optional)" className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
          </div>
          <button onClick={() => pingMut.mutate()} disabled={pingMut.isPending || !riderId || !lat || !lng} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Send Ping</button>
        </div>

        <div className="bg-black rounded-xl p-4">
          <h2 className="font-semibold text-white mb-3">Latest Known Location</h2>
          {loc ? (
            <div className="text-gray-300 space-y-1">
              <p>Lat: {loc.lat}, Lng: {loc.lng}</p>
              {loc.heading != null && <p>Heading: {loc.heading}°</p>}
              {loc.speed != null && <p>Speed: {loc.speed}</p>}
              <p className="text-gray-500">Captured: {new Date(loc.captured_at).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-gray-500">No location yet for this rider.</p>
          )}
        </div>
      </div>

      <div className="bg-black rounded-xl overflow-hidden">
        <h2 className="p-4 font-semibold text-white">Order Route ({pings.length} pings)</h2>
        <DataTable columns={routeColumns} data={pings} />
      </div>
    </div>
  );
}
