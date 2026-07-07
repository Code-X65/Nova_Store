import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';

export default function TopProducts() {
  const [period, setPeriod] = useState('30d');

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-top-products', period],
    queryFn: async () => {
      const { data } = await api.get('/admin/sales/top-products', {
        params: { period }
      });
      return data.data; // { products: [] }
    }
  });

  const products = response?.products || [];

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: ({ row }) => <span className="font-bold text-nova-400">#{row.index + 1}</span>
    },
    {
      accessorKey: 'name',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-white">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.sku || 'No SKU'}</div>
        </div>
      )
    },
    {
      accessorKey: 'units_sold',
      header: 'Units Sold',
      cell: (info) => <span className="text-sm font-semibold text-white">{info.getValue() as number}</span>
    },
    {
      accessorKey: 'total_revenue',
      header: 'Revenue generated',
      cell: (info) => <span className="text-sm text-gray-300">${Number(info.getValue() || 0).toFixed(2)}</span>
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Top Products</h1>
          <p className="text-sm text-muted-foreground mt-1">Best-selling items by volume and revenue.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-muted-foreground">Loading best sellers...</div>
        ) : products.length === 0 ? (
          <div className="flex justify-center items-center h-64 text-muted-foreground">No sales data for this period.</div>
        ) : (
          <DataTable data={products} columns={columns} pageSize={10} />
        )}
      </div>
    </div>
  );
}