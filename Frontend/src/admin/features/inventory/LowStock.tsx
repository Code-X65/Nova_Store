import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface LowStockProduct {
 id: string;
 name: string;
 sku: string;
 stock_quantity: number;
 low_stock_threshold: number;
}

export default function LowStock() {
 const { data: response, isLoading } = useQuery({
 queryKey: ['inventory', 'low-stock'],
 queryFn: async () => {
 const { data } = await api.get('/inventory/low-stock');
 // The controller returns { success: true, data: [...] }
 return data.data;
 },
 });

 const products = response || [];

 const columns = useMemo<ColumnDef<LowStockProduct>[]>(() => [
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
 return <span className={clsx("font-bold", qty <= 0 ?"text-danger" :"text-warning")}>{qty}</span>;
 },
 },
 {
 accessorKey: 'low_stock_threshold',
 header: 'Threshold',
 cell: (info) => <span className="text-muted-foreground">{info.getValue() as number}</span>
 },
 {
 id: 'actions',
 header: '',
 cell: ({ row }) => (
 <div className="flex justify-end gap-2">
 <Link
 to={`/inventory/adjust?product=${row.original.id}`}
 className="btn-primary py-1.5 px-3 text-xs"
 >
 Reorder / Add Stock
 </Link>
 </div>
 ),
 },
 ], []);

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white flex items-center gap-2">
 <ExclamationTriangleIcon className="w-6 h-6 text-warning" />
 Low Stock Alerts
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Products that have fallen below their minimum stock threshold.
 </p>
 </div>
 </div>

 <div className="glass-card p-4 rounded-xl border space-y-4">
 <div className="h-[500px]">
 {isLoading ? (
 <div className="flex items-center justify-center h-full text-muted-foreground">
 Loading low stock data...
 </div>
 ) : products.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full space-y-3">
 <div className="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center">
 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <p className="text-white font-medium">All clear!</p>
 <p className="text-muted-foreground text-sm">No products are currently low on stock.</p>
 </div>
 ) : (
 <DataTable data={products} columns={columns} pageSize={10} />
 )}
 </div>
 </div>
 </div>
 );
}