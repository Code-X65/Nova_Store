import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTransactions } from './api/inventory';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import clsx from 'clsx';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface Transaction {
  id: string;
  type: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string;
  created_at: string;
  products: { name: string; sku: string };
}

interface PaginatedTransactions {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['inventory', 'transactions', page, typeFilter],
    queryFn: async () => (await fetchTransactions({ page, limit: 20, type: typeFilter || undefined })) as PaginatedTransactions,
  });

  const transactions = response?.transactions || [];
  const pagination = response?.pagination;

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
  {
  accessorKey: 'created_at',
  header: 'Date',
  cell: (info) => (
  <span className="text-muted-foreground whitespace-nowrap">
  {format(new Date(info.getValue() as string), 'MMM d, yyyy HH:mm')}
  </span>
  ),
  },
  {
  id: 'product',
  header: 'Product',
  cell: ({ row }) => (
  <div className="flex flex-col">
  <span className="font-medium text-white">{row.original.products?.name || 'Unknown'}</span>
  <span className="text-xs text-muted-foreground">{row.original.products?.sku || 'Unknown'}</span>
  </div>
  ),
  },
  {
  accessorKey: 'type',
  header: 'Type',
  cell: (info) => {
  const type = info.getValue() as string;
  let colorClass = 'bg-surface-2 text-white';
  if (type === 'restock') colorClass = 'bg-success/10 text-success';
  if (type === 'sale') colorClass = 'bg-nova-500/10 text-nova-400';
  if (type === 'adjustment') colorClass = 'bg-warning/10 text-warning';
  if (type === 'return') colorClass = 'bg-purple-500/10 text-purple-400';

  return (
  <span className={clsx('px-2 py-1 rounded text-xs uppercase font-semibold tracking-wider', colorClass)}>
  {type}
  </span>
  );
  },
  },
  {
  accessorKey: 'quantity_change',
  header: 'Change',
  cell: (info) => {
  const val = info.getValue() as number;
  return (
  <span className={clsx("font-bold", val > 0 ?"text-success" :"text-danger")}>
  {val > 0 ? `+${val}` : val}
  </span>
  );
  },
  },
  {
  id: 'before_after',
  header: 'Before -> After',
  cell: ({ row }) => (
  <span className="text-muted-foreground">
  {row.original.previous_quantity} <span className="mx-1">&rarr;</span> <span className="text-white">{row.original.new_quantity}</span>
  </span>
  ),
  },
  {
  accessorKey: 'notes',
  header: 'Notes',
  cell: (info) => (
  <span className="text-sm text-muted-foreground max-w-[200px] truncate block" title={info.getValue() as string}>
  {info.getValue() as string || '-'}
  </span>
  ),
  },
  ], []);

  return (
  <div className="space-y-6">
  <div className="flex items-center justify-between">
  <div>
  <h1 className="text-2xl font-bold text-white">Transaction History</h1>
  <p className="text-sm text-muted-foreground mt-1">
  Audit log of all stock adjustments, sales, and returns.
  </p>
  </div>
  </div>

  <div className="glass-card p-4 rounded-xl border space-y-4">
  <div className="flex gap-4">
  <select
  value={typeFilter}
  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
  className="bg-surface-2 border rounded-lg px-4 py-2 text-sm text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-colors"
  >
  <option value="">All Types</option>
  <option value="restock">Restock</option>
  <option value="sale">Sale</option>
  <option value="adjustment">Adjustment</option>
  <option value="return">Return</option>
  </select>
  </div>

  <div className="h-[600px]">
  {isLoading ? (
  <div className="flex items-center justify-center h-full text-muted-foreground">
  Loading history...
  </div>
  ) : (
  <>
  <DataTable data={transactions} columns={columns} pageSize={10} />
  {pagination && pagination.totalPages > 1 && (
  <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a1a1a]">
  <div className="flex items-center text-xs text-gray-400">
  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
  </div>
  <div className="flex gap-2">
  <button
  onClick={() => setPage(p => Math.max(1, p - 1))}
  disabled={pagination.page <= 1}
  className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
  <ChevronLeftIcon className="w-5 h-5" />
  </button>
  <button
  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
  disabled={pagination.page >= pagination.totalPages}
  className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
  <ChevronRightIcon className="w-5 h-5" />
  </button>
  </div>
  </div>
  )}
  </>
  )}
  </div>
  </div>
  </div>
  );
}