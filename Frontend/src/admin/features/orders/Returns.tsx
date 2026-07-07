import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrders } from './api/orders';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';

const columnHelper = createColumnHelper<any>();

const columns = [
  columnHelper.accessor('order_number', {
    header: 'Order #',
    cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <span className="text-gray-300">{info.getValue().replace('_', ' ').toUpperCase()}</span>,
  }),
  columnHelper.accessor('total_amount', {
    header: 'Refund Amount',
    cell: (info) => <span className="text-gray-300">${Number(info.getValue()).toFixed(2)}</span>,
  })
];

export default function Returns() {
  const navigate = useNavigate();
  // For returns, we might query orders that are in some return state
  const { data, isLoading } = useQuery({
    queryKey: ['admin-returns'],
    queryFn: () => fetchOrders({ status: 'returned' }), // Adjust backend filter as needed
  });

  return (
    <div className="flex flex-col h-full space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Returns Management</h1>
      <div className="flex-1 bg-[#14151a] border border-gray-800 rounded-xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Loading returns...</div>
        ) : (
          <DataTable
            columns={columns}
            data={data?.orders || []}
            onRowClick={(row) => navigate(`/admin/orders/${row.id}`)}
          />
        )}
      </div>
    </div>
  );
}