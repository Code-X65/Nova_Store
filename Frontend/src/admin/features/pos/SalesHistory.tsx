import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fetchPosSales, type Order } from './api/pos';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

function money(n: number) {
  return `₦${Number(n || 0).toFixed(2)}`;
}

const columnHelper = createColumnHelper<Order>();

const columns = [
  columnHelper.accessor('order_number', {
    header: 'Order #',
    cell: (info) => (
      <Link to={`/orders/${info.row.original.id}`} className="text-nova-400 hover:underline font-medium">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('customer_email', {
    header: 'Customer',
    cell: (info) => <span className="text-gray-400">{info.getValue() || 'Walk-in'}</span>,
  }),
  columnHelper.accessor('total_amount', {
    header: 'Total',
    cell: (info) => <span className="text-white font-medium text-right block">{money(info.getValue())}</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase text-emerald-400 bg-emerald-500/10">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('created_at', {
    header: 'Date',
    cell: (info) => <span className="text-gray-400">{format(new Date(info.getValue()), 'MMM d, yyyy HH:mm')}</span>,
  }),
];

export default function SalesHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-pos-sales', page],
    queryFn: () => fetchPosSales({ page, limit: 20 }),
  });

  const orders = data?.orders || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">POS Sales History</h1>
        <p className="text-sm text-gray-400 mt-1">Walk-in and offline sales recorded via the POS terminal.</p>
      </div>

      <div className="bg-black rounded-xl overflow-hidden border border-white/10">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No POS sales yet.</div>
        ) : (
          <DataTable columns={columns} data={orders} disablePagination />
        )}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm bg-white/5 text-white rounded disabled:opacity-30">Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-400">Page {page} of {data.pagination.totalPages}</span>
          <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm bg-white/5 text-white rounded disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
