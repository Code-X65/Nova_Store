import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon, PhotoIcon, ExclamationTriangleIcon, StarIcon, MagnifyingGlassIcon, ArrowUpTrayIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { ProductsFilterBar, type ProductFilters } from './products/ProductsFilterBar';
import { BulkProductImportModal } from './products/BulkProductImportModal';
import { ProductPreviewModal } from './products/ProductPreviewModal';

export default function ProductsList() {
 const qc = useQueryClient();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();

 // State
 const [filters, setFilters] = useState<ProductFilters>({
 search: searchParams.get('search') || '',
 category_id: searchParams.get('category_id') || '',
 brand_id: searchParams.get('brand_id') || '',
 status: searchParams.get('status') || '',
 minPrice: searchParams.get('minPrice') || '',
 maxPrice: searchParams.get('maxPrice') || '',
 });
 const [page, setPage] = useState(1);
 const [limit] = useState(20);
 const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
 const [previewProduct, setPreviewProduct] = useState<any>(null);

 // Data fetching
 const { data: response, isLoading, isFetching } = useQuery({
 queryKey: ['products', { ...filters, page, limit }],
 queryFn: async () => {
 const params = new URLSearchParams();
 Object.entries(filters).forEach(([k, v]) => {
 if (v) params.set(k, v);
 });
 params.set('page', page.toString());
 params.set('limit', limit.toString());

 const { data } = await api.get(`/products?${params.toString()}`);
 return data.data; // { products, pagination }
 },
 staleTime: 10_000,
 });

 const products = response?.products || [];
 const pagination = response?.pagination || { total: 0, pages: 1, page: 1, limit: 20 };

 // Mutations
 const deleteMutation = useMutation({
 mutationFn: async (id: string) => api.delete(`/products/${id}`),
 onMutate: async (id: string) => {
 const queryKey = ['products', { ...filters, page, limit }];
 await qc.cancelQueries({ queryKey });
 const previous = qc.getQueryData<any>(queryKey);

 if (previous) {
 qc.setQueryData(queryKey, {
 ...previous,
 products: previous.products.filter((p: any) => p.id !== id)
 });
 }
 return { previous, queryKey };
 },
 onSuccess: () => {
 toast.success('Product archived successfully');
 },
 onError: (err: any, variables, context) => {
 if (context?.previous) {
 qc.setQueryData(context.queryKey, context.previous);
 }
 toast.error(err?.response?.data?.message ?? 'Failed to archive product');
 },
 onSettled: () => {
 qc.invalidateQueries({ queryKey: ['products'] });
 },
 });

 const columns = useMemo<ColumnDef<any>[]>(() => [
 {
 id: 'image',
 header: 'Image',
 cell: ({ row }) => {
 const thumb = row.original.primary_image_url || row.original.image_gallery?.[0] || row.original.thumbnail_url;
 return (
 <div className="w-10 h-10 rounded-lg bg-[var(--neu-bg)] shadow-[var(--neu-inner)] flex items-center justify-center overflow-hidden flex-shrink-0">
 {thumb ? (
 <img
 src={thumb}
 alt={row.original.name}
 className="w-full h-full object-cover"
 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 ) : (
 <PhotoIcon className="w-5 h-5 text-[var(--neu-text)] opacity-40" />
 )}
 </div>
 );
 },
 size: 60,
 },
 {
 accessorKey: 'name',
 header: 'Product',
 cell: ({ row }) => (
 <div className="min-w-0">
 <div className="font-bold text-white text-sm truncate max-w-[250px]" title={row.original.name}>
 {row.original.name}
 </div>
 <div className="text-[10px] font-mono text-[var(--neu-text)] mt-0.5 truncate">
 {row.original.sku}
 </div>
 </div>
 ),
 size: 250,
 },
 {
 id: 'classification',
 header: 'Classification',
 cell: ({ row }) => (
 <div className="space-y-1">
 <div className="text-xs text-[var(--neu-text)] truncate max-w-[150px]">
 <span className="font-semibold text-white/70">Cat:</span> {row.original.category?.name || '—'}
 </div>
 <div className="text-xs text-[var(--neu-text)] truncate max-w-[150px]">
 <span className="font-semibold text-white/70">Br:</span> {row.original.brand?.name || '—'}
 </div>
 </div>
 ),
 },
 {
 accessorKey: 'price',
 header: 'Price',
 cell: ({ row }) => {
 const price = Number(row.original.price);
 const sale = Number(row.original.sale_price);
 const hasSale = sale > 0 && sale < price;

 return (
 <div className="font-mono">
 {hasSale ? (
 <div className="flex flex-col">
 <span className="text-emerald-400 font-bold">${sale.toFixed(2)}</span>
 <span className="text-[10px] text-[var(--neu-text)] line-through">${price.toFixed(2)}</span>
 </div>
 ) : (
 <span className="text-white font-bold">${price.toFixed(2)}</span>
 )}
 </div>
 );
 },
 },
 {
 accessorKey: 'stock_quantity',
 header: 'Stock',
 cell: ({ row }) => {
 const stock = row.original.stock_quantity;
 const low = row.original.low_stock_threshold || 5;
 const isLow = stock > 0 && stock <= low;

 if (stock === 0) {
 return <span className="badge-danger">Out of Stock</span>;
 }

 return (
 <div className="flex items-center gap-1.5">
 <span className="font-mono text-sm text-white">{stock}</span>
 {isLow && (
 <div className="flex items-center text-orange-400" title="Low stock warning">
 <ExclamationTriangleIcon className="w-3.5 h-3.5" />
 </div>
 )}
 </div>
 );
 },
 },
 {
 accessorKey: 'status',
 header: 'Status',
 cell: ({ row }) => {
 const s = row.original.status;
 const cls = 
 s === 'published' ? 'badge-success' :
 s === 'archived' ? 'badge-danger' : 'badge-muted';
 
 return (
 <div className="flex flex-col items-start gap-1">
 <span className={`${cls} capitalize`}>{s}</span>
 {row.original.is_featured && (
 <span className="badge-nova flex items-center gap-1 text-[9px] px-1 py-0 border-none">
 <StarIcon className="w-2.5 h-2.5" /> Featured
 </span>
 )}
 </div>
 );
 },
 },
 {
 id: 'actions',
 header: '',
 cell: ({ row }) => (
 <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() => setPreviewProduct(row.original)}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
 title="Preview Product"
 >
 <EyeIcon className="w-4 h-4" />
 </button>
 <button
 onClick={() => navigate(`/catalog/products/${row.original.id}`)}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
 title="Edit Product"
 >
 <PencilIcon className="w-4 h-4" />
 </button>
 <button
 onClick={() => {
 if (confirm(`Archive ${row.original.sku}? It will be hidden from the storefront.`)) {
 deleteMutation.mutate(row.original.id);
 }
 }}
 disabled={row.original.status === 'archived' || deleteMutation.isPending}
 className="p-1.5 text-[var(--neu-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-30"
 title="Archive Product"
 >
 <TrashIcon className="w-4 h-4" />
 </button>
 </div>
 ),
 },
 ], []);

 return (
 <div className="space-y-6 w-full">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div>
 <h1 className="page-title">Products</h1>
 <p className="text-sm text-[var(--neu-text)] mt-1">
 Manage your store's catalog, pricing, and inventory.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button 
 onClick={() => setIsBulkImportOpen(true)}
 className="btn-secondary flex items-center gap-2"
 >
 <ArrowUpTrayIcon className="w-4 h-4" />
 Bulk Import
 </button>
 <Link to="/catalog/products/new" className="btn-primary flex items-center gap-2">
 <PlusIcon className="w-4 h-4" />
 New Product
 </Link>
 </div>
 </div>

 {/* Filter Bar */}
 <ProductsFilterBar
 filters={filters}
 onChange={(newFilters) => {
 setFilters(newFilters);
 setPage(1); // Reset page on filter change
 }}
 />

 {/* Main Table Panel */}
 <div className="glass-card rounded-2xl overflow-hidden">
 <div className="px-6 py-4 flex items-center justify-between mb-4">
 <p className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-widest">
 Product Directory
 {isFetching && <span className="ml-3 text-[var(--neu-accent)] lowercase normal-case">Updating…</span>}
 </p>
 <p className="text-xs text-[var(--neu-text)] font-mono">
 Total: {pagination.total}
 </p>
 </div>

 <div className="min-h-[400px]">
 {isLoading ? (
 <div className="flex flex-col animate-pulse">
 {[...Array(6)].map((_, i) => (
 <div key={i} className="flex items-center gap-4 px-6 py-4 mb-2 bg-[var(--neu-bg)] rounded-xl shadow-[var(--neu-inner)]">
 <div className="w-10 h-10 rounded-lg bg-[var(--neu-bg)]"></div>
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-[var(--neu-bg)] rounded w-1/3"></div>
 <div className="h-3 bg-[var(--neu-bg)] rounded w-1/4"></div>
 </div>
 <div className="w-24 h-6 bg-[var(--neu-bg)] rounded"></div>
 <div className="w-16 h-6 bg-[var(--neu-bg)] rounded"></div>
 </div>
 ))}
 </div>
 ) : products.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-24 text-center">
 <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
 <MagnifyingGlassIcon className="w-6 h-6 text-[var(--neu-text)] opacity-50" />
 </div>
 <p className="text-base font-medium text-white">No products found</p>
 <p className="text-sm text-[var(--neu-text)] mt-1">
 Adjust your filters or add a new product.
 </p>
 </div>
 ) : (
 <DataTable 
 data={products} 
 columns={columns} 
 pageSize={limit}
 // Ideally we'd pass total rows to DataTable for server-side pagination rendering,
 // but assuming DataTable currently uses client-side pagination UI given existing code.
 // We will just let DataTable render the current page's chunk.
 />
 )}
 </div>
 
 {/* Simple pagination controls since we do server-side fetching */}
 {pagination.totalPages > 1 && (
 <div className="px-6 py-4 flex justify-between items-center bg-[var(--neu-bg)]/50 mt-4 rounded-xl">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page === 1}
 className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-30"
 >
 Previous
 </button>
 <span className="text-xs text-[var(--neu-text)] font-mono">
 Page {page} of {pagination.totalPages}
 </span>
 <button
 onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
 disabled={page === pagination.totalPages}
 className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-30"
 >
 Next
 </button>
 </div>
 )}
 </div>

 <BulkProductImportModal 
 isOpen={isBulkImportOpen}
 onClose={() => setIsBulkImportOpen(false)}
 />

 <ProductPreviewModal
 isOpen={!!previewProduct}
 onClose={() => setPreviewProduct(null)}
 product={previewProduct}
 />
 </div>
 );
}