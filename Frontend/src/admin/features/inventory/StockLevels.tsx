import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface ProductStock {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: string;
}

interface PaginatedProducts {
  products: ProductStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function StockLevels() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'stock-levels', search, page],
    queryFn: async () => {
      const { data } = await api.get('/products', {
        params: { search, limit: 20, page }
      });
      return data.data as PaginatedProducts;
    },
  });

  const products = data?.products || [];
  const pagination = data?.pagination;

  const columns = useMemo<ColumnDef<ProductStock>[]>(() => [
  {
  accessorKey: 'name',
  header: 'Product Name',
  cell: (info) => (
  <div className="flex flex-col">
  <span className="font-medium text-white">{info.getValue() as string}</span>
  <span className="text-xs text-muted-foreground">{info.row.original.sku}</span>
  </div>
  ),
  },
  {
  accessorKey: 'stock_quantity',
  header: 'Current Stock',
  cell: (info) => {
  const qty = info.getValue() as number;
  return <span className="font-semibold text-white">{qty}</span>;
  },
  },
  {
  id: 'status',
  header: 'Status',
  cell: ({ row }) => {
  const qty = row.original.stock_quantity;
  const threshold = row.original.low_stock_threshold;

  let statusText = 'In Stock';
  let badgeClass = 'bg-success/10 text-success border border-success/20';

  if (qty <= 0) {
  statusText = 'Out of Stock';
  badgeClass = 'bg-danger/10 text-danger border border-danger/20';
  } else if (qty <= threshold) {
  statusText = 'Low Stock';
  badgeClass = 'bg-warning/10 text-warning border border-warning/20';
  }

  return (
  <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', badgeClass)}>
  {statusText}
  </span>
  );
  },
  },
  {
  id: 'actions',
  header: '',
  cell: ({ row }) => (
  <div className="flex justify-end gap-2">
  <Link
  to={`/inventory/adjust?product=${row.original.id}`}
  className="btn-ghost p-1.5 rounded-md hover:bg-nova-500/10 hover:text-nova-400 transition-colors"
  title="Adjust Stock"
  >
  <PlusIcon className="w-4 h-4" />
  </Link>
  </div>
  ),
  },
  ], []);

  return (
  <div className="space-y-6">
  <div className="flex items-center justify-between">
  <div>
  <h1 className="text-2xl font-bold text-white">Stock Levels</h1>
  <p className="text-sm text-muted-foreground mt-1">
  Monitor current inventory levels across all products.
  </p>
  </div>
  <Link to="/inventory/adjust" className="btn-primary">
  Adjust Stock
  </Link>
  </div>

  <div className="glass-card p-4 rounded-xl border space-y-4">
  <div className="flex gap-4">
  <div className="relative flex-1 max-w-sm">
  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  <input
  type="text"
  placeholder="Search by name or SKU..."
  value={search}
  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
  className="w-full bg-surface-2 border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-colors"
  />
  </div>
  </div>

  <div className="h-[500px]">
  {isLoading ? (
  <div className="flex items-center justify-center h-full text-muted-foreground">
  Loading inventory...
  </div>
  ) : (
  <>
  <DataTable data={products} columns={columns} pageSize={10} />
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