import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInvoices, generateInvoice, invoicePdfUrl, type Invoice } from './api/billing';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

const statusColor = (s: string) => {
  if (s === 'completed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s === 'failed') return 'bg-red-500/10 text-red-400 border-red-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

function money(n: number) {
  return `₦${Number(n || 0).toFixed(2)}`;
}

const columnHelper = createColumnHelper<Invoice>();

export default function Invoices() {
  const qc = useQueryClient();
  const [orderNumber, setOrderNumber] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', { orderNumber }],
    queryFn: () => fetchInvoices({ page: 1, limit: 20, orderNumber: orderNumber || undefined }),
  });

  const genMut = useMutation({
    mutationFn: (orderId: string) => generateInvoice(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoices'] }),
  });

  const invoices: Invoice[] = data?.invoices || [];

  const columns = React.useMemo(() => [
    columnHelper.accessor('invoice_no', {
      header: 'Invoice #',
      cell: (info) => <span className="text-white font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('order_number', {
      header: 'Order',
      cell: (info) => <span className="text-gray-300">{info.getValue()}</span>,
    }),
    columnHelper.accessor('total_amount', {
      header: 'Total',
      cell: (info) => <div className="text-right text-gray-300">{money(info.getValue())}</div>,
    }),
    columnHelper.accessor('issued_at', {
      header: 'Issued',
      cell: (info) => <span className="text-gray-400">{new Date(info.getValue()).toLocaleString()}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const inv = info.row.original;
        return (
          <div className="text-right">
            {inv.pdf_url ? (
              <a
                href={invoicePdfUrl(inv)}
                target="_blank"
                rel="noreferrer"
                className="text-nova-500 hover:underline mr-3"
              >
                Download
              </a>
            ) : (
              <button
                onClick={() => genMut.mutate(inv.order_id)}
                disabled={genMut.isPending}
                className="text-nova-500 hover:underline disabled:opacity-50"
              >
                Generate
              </button>
            )}
          </div>
        );
      },
    }),
  ], [genMut]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">Invoices</h1>
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Filter by order #"
          className="bg-black text-gray-300 text-sm rounded-lg border border-white/10 p-2.5 outline-none"
        />
      </div>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No invoices yet. They are auto-generated when an order is delivered or paid.</div>
        ) : (
          <DataTable columns={columns} data={invoices} />
        )}
      </div>
    </div>
  );
}
