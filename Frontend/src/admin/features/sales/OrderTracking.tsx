import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

export default function OrderTracking() {
 const [page, setPage] = useState(1);

 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-sales-order-tracking', page],
 queryFn: async () => {
 // Use the generic orders list since it's the same controller method
 const { data } = await api.get('/admin/sales/order-tracking', {
 params: { page, limit: 20 }
 }).catch(err => {
 // Fallback if sales/order-tracking isn't perfectly mapped, though it should be
 return api.get('/orders/admin/list', { params: { page, limit: 20 } });
 });
 return data.data; // { orders }
 }
 });

 const orders = response?.orders || [];

 const columns = useMemo<ColumnDef<any>[]>(() => [
 {
 accessorKey: 'id',
 header: 'Order #',
 cell: (info) => <span className="font-mono text-nova-400 text-xs">{(info.getValue() as string).slice(0, 8)}</span>
 },
 {
 accessorKey: 'status',
 header: 'Fulfillment Status',
 cell: ({ row }) => {
 const s = row.original.status || 'pending';
 return (
 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${s === 'delivered' ? 'bg-success/20 text-success' : s === 'cancelled' ? 'bg-danger/20 text-danger' : 'bg-white/10 text-gray-300'}`}>
 {s}
 </span>
 );
 }
 },
 {
 accessorKey: 'payment_status',
 header: 'Payment',
 cell: ({ row }) => {
 const p = row.original.payment_status || 'pending';
 return <span className="text-xs uppercase font-semibold text-gray-400">{p}</span>;
 }
 },
 {
 accessorKey: 'total_amount',
 header: 'Total',
 cell: (info) => <span className="font-medium text-white">${Number(info.getValue() || 0).toFixed(2)}</span>
 },
 {
 accessorKey: 'created_at',
 header: 'Date',
 cell: (info) => <span className="text-xs text-muted-foreground">{format(new Date(info.getValue() as string), 'MMM d, HH:mm')}</span>
 }
 ], []);

 return (
 <div className="space-y-6 w-full">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Order Tracking</h1>
 <p className="text-sm text-muted-foreground mt-1">Cross-departmental read-only view of recent orders and their statuses.</p>
 </div>
 </div>

 <div className="glass-card p-4 rounded-xl border">
 <div className="h-[600px]">
 {isLoading ? (
 <div className="flex justify-center items-center h-full text-muted-foreground">Loading orders...</div>
 ) : (
 <DataTable data={orders} columns={columns} pageSize={15} />
 )}
 </div>
 </div>
 </div>
 );
}