import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/shared/ui/DataTable';
import { fetchOrders, type Order } from './api/orders';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<Order>();

const columns = [
 columnHelper.accessor('order_number', {
 header: 'Order #',
 cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
 }),
 columnHelper.accessor('created_at', {
 header: 'Date',
 cell: (info) => <span className="text-gray-400">{format(new Date(info.getValue()), 'MMM d, yyyy HH:mm')}</span>,
 }),
 columnHelper.accessor((row) => `${row.user.first_name} ${row.user.last_name}`, {
 id: 'customer',
 header: 'Customer',
 cell: (info) => <span className="text-gray-300">{info.getValue()}</span>,
 }),
 columnHelper.accessor('total_amount', {
 header: 'Total',
 cell: (info) => <span className="text-gray-300">${Number(info.getValue()).toFixed(2)}</span>,
 }),
  columnHelper.accessor('status', {
  header: 'Status',
  cell: (info) => {
  const val = info.getValue();
  let colorClass = 'bg-gray-500/10 text-gray-400 /20';
  if (val === 'processing') colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (val === 'ready_for_dispatch') colorClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  if (val === 'dispatched') colorClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  if (val === 'out_for_delivery') colorClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  if (val === 'delivery_attempted') colorClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  if (val === 'delivered') colorClass = 'bg-green-500/10 text-green-400 border-green-500/20';
  if (val === 'completed') colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (val === 'cancelled') colorClass = 'bg-red-500/10 text-red-400 border-red-500/20';
  if (val === 'returned') colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (val === 'refunded') colorClass = 'bg-pink-500/10 text-pink-400 border-pink-500/20';
  
  return (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
  {val.replace('_', ' ').toUpperCase()}
  </span>
  );
  },
  }),
 columnHelper.accessor('delivery_status', {
 header: 'Delivery',
 cell: (info) => {
 const val = info.getValue();
 let colorClass = 'bg-gray-500/10 text-gray-400 /20';
 if (val === 'dispatched') colorClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
 if (val === 'delivered') colorClass = 'bg-green-500/10 text-green-400 border-green-500/20';
 
 return (
 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
 {val ? val.replace(/_/g, ' ').toUpperCase() : 'PENDING'}
 </span>
 );
 },
 }),
];

export default function OrdersList() {
 const navigate = useNavigate();
 const [page, setPage] = useState(1);
 const [status, setStatus] = useState<string>('');

 const { data, isLoading, isError } = useQuery({
 queryKey: ['admin-orders', { page, status }],
 queryFn: () => fetchOrders({ page, limit: 10, status: status || undefined }),
 });

 return (
 <div className="flex flex-col h-full space-y-6">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <h1 className="text-2xl font-bold text-white tracking-tight">Orders</h1>
  <div className="flex items-center gap-3">
  <select
  value={status}
  onChange={(e) => {
  setStatus(e.target.value);
  setPage(1);
  }}
  className="bg-black text-gray-300 text-sm rounded-lg focus:ring-nova-500 focus:border-nova-500 block w-full p-2.5 outline-none transition-colors"
  >
  <option value="">All Statuses</option>
  <option value="pending">Pending</option>
  <option value="processing">Processing</option>
  <option value="ready_for_dispatch">Ready for Dispatch</option>
  <option value="dispatched">Dispatched</option>
  <option value="out_for_delivery">Out for Delivery</option>
  <option value="delivery_attempted">Delivery Attempted</option>
  <option value="delivered">Delivered</option>
  <option value="completed">Completed</option>
  <option value="cancelled">Cancelled</option>
  <option value="returned">Returned</option>
  <option value="refunded">Refunded</option>
  </select>
  </div>
 </div>

 <div className="flex-1 bg-black rounded-xl overflow-hidden flex flex-col">
 {isLoading ? (
 <div className="flex-1 flex items-center justify-center text-gray-400">Loading orders...</div>
 ) : isError ? (
 <div className="flex-1 flex items-center justify-center text-red-400">Error loading orders.</div>
 ) : (
 <DataTable
 columns={columns}
 data={data?.orders || []}
 onRowClick={(row) => navigate(`/orders/${row.id}`)}
 />
 )}
 </div>
 </div>
 );
}