import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ProductsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: async () => {
      const { data } = await api.get('/products', {
        params: { search, page, limit: 20 },
      });
      return data.data; // { products, pagination }
    },
  });

  const products = response?.products || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to delete product'),
  });

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'image',
      header: '',
      cell: ({ row }) => {
        const image = row.original.images?.[0];
        return (
          <div className="w-10 h-10 rounded bg-surface border border-white/5 overflow-hidden">
            {image ? (
              <img src={image} alt={row.original.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center text-xs text-muted-foreground">
                No Img
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'name',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-white">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.sku}</div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.category?.name || 'Uncategorized'}</span>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => (
        <span className="font-medium text-white">
          ${Number(row.original.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      accessorKey: 'stock_quantity',
      header: 'Stock',
      cell: ({ row }) => {
        const stock = row.original.stock_quantity;
        return (
          <span className={stock > 0 ? "text-success font-medium" : "text-danger font-medium"}>
            {stock > 0 ? `${stock} in stock` : 'Out of stock'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={`/admin/catalog/products/${row.original.id}`}
            className="p-1.5 text-muted-foreground hover:text-white rounded-md hover:bg-surface-2"
          >
            <PencilIcon className="w-4 h-4" />
          </Link>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this product?')) {
                deleteMutation.mutate(row.original.id);
              }
            }}
            className="p-1.5 text-muted-foreground hover:text-danger rounded-md hover:bg-danger/10"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your store's catalog.
          </p>
        </div>
        <Link to="/admin/catalog/products/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-sm bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
          />
        </div>

        <div className="h-[600px] group-hover-visible">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading products...
            </div>
          ) : (
            <DataTable 
              data={products} 
              columns={columns} 
              pageSize={10} 
            />
          )}
        </div>
      </div>
    </div>
  );
}