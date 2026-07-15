import { useMemo } from 'react';
import { PencilIcon, TrashIcon, PhotoIcon, StarIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

export interface Brand {
 id: string;
 name: string;
 slug: string;
 description: string | null;
 logo_url: string | null;
 thumbnail_url: string | null;
 banner_url: string | null;
 website_url: string | null;
 is_featured: boolean;
 is_active: boolean;
 meta_title: string | null;
 meta_description: string | null;
 meta_keywords: string[] | null;
 product_count: number;
 created_at: string;
 updated_at: string;
}

interface BrandsTableProps {
 brands: Brand[];
 isLoading: boolean;
 onEdit: (brand: Brand) => void;
 onDelete: (brand: Brand) => void;
}

function SkeletonRow() {
 return (
 <tr className="animate-pulse">
 {[12, 40, 24, 20, 24].map((w, i) => (
 <td key={i} className="px-4 py-4">
 <div className={`h-4 bg-white/5 rounded-full`} style={{ width: `${w * 3}px` }} />
 </td>
 ))}
 </tr>
 );
}

const columnHelper = createColumnHelper<Brand>();

export function BrandsTable({ brands, isLoading, onEdit, onDelete }: BrandsTableProps) {
 const columns = useMemo(() => [
 columnHelper.display({
 id: 'logo',
 header: 'Logo',
 cell: (info) => {
 const brand = info.row.original;
 return (
 <div className="w-10 h-10 bg-transparent flex items-center justify-center overflow-hidden">
 {brand.logo_url || brand.thumbnail_url ? (
 <img
 src={brand.logo_url || brand.thumbnail_url || ''}
 alt={brand.name}
 className="w-full h-full object-cover"
 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 ) : (
 <PhotoIcon className="w-5 h-5 text-[var(--neu-text)] opacity-40" />
 )}
 </div>
 );
 },
 }),
 columnHelper.display({
 id: 'name',
 header: 'Name',
 cell: (info) => {
 const brand = info.row.original;
 return (
 <>
 <p className="font-bold text-white text-sm">{brand.name}</p>
 <p className="text-[10px] font-mono text-[var(--neu-text)] mt-0.5 truncate max-w-[200px]">
 /{brand.slug}
 </p>
 </>
 );
 },
 }),
 columnHelper.accessor('product_count', {
 header: 'Products',
 cell: (info) => {
 const brand = info.row.original;
 return brand.product_count > 0 ? (
 <Link
 to={`/catalog/products?brand_id=${brand.id}`}
 className="badge-muted hover:text-blue-400 hover:border-blue-400/50 cursor-pointer transition-colors"
 title="View Products"
 >
 {brand.product_count}
 </Link>
 ) : (
 <span className="badge-muted">{brand.product_count}</span>
 );
 },
 }),
 columnHelper.display({
 id: 'status',
 header: 'Status',
 cell: (info) => {
 const brand = info.row.original;
 return (
 <div className="flex items-center gap-1.5">
 {brand.is_active ? (
 <span className="badge-success">Active</span>
 ) : (
 <span className="badge-muted">Inactive</span>
 )}
 {brand.is_featured && (
 <span className="badge-nova flex items-center gap-1">
 <StarIcon className="w-3 h-3" /> Featured
 </span>
 )}
 </div>
 );
 },
 }),
 columnHelper.display({
 id: 'actions',
 header: '',
 cell: (info) => {
 const brand = info.row.original;
 return (
 <div className="flex items-center justify-end gap-1">
 <button
 onClick={() => onEdit(brand)}
 className="p-2 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
 title="Edit Brand"
 >
 <PencilIcon className="w-4 h-4" />
 </button>
 <button
 onClick={() => onDelete(brand)}
 className="p-2 text-[var(--neu-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
 title="Archive Brand"
 >
 <TrashIcon className="w-4 h-4" />
 </button>
 </div>
 );
 },
 }),
 ], [onEdit, onDelete]);

 if (isLoading) {
 return (
 <div className="table-wrapper overflow-x-auto">
 <table className="table min-w-[600px]">
 <thead>
 <tr>
 <th className="w-16">Logo</th>
 <th>Name</th>
 <th>Products</th>
 <th>Status</th>
 <th className="text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
 </tbody>
 </table>
 </div>
 );
 }

 if (brands.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center py-24 text-center">
 <PhotoIcon className="w-12 h-12 text-[var(--neu-text)] opacity-30 mb-4" />
 <p className="text-base font-medium text-white">No brands found</p>
 <p className="text-sm text-[var(--neu-text)] mt-1 max-w-sm">
 Try adjusting your filters, or create a new brand to get started.
 </p>
 </div>
 );
 }

 return (
 <DataTable columns={columns} data={brands} rowClassName={(brand) => (brand.is_active ? '' : 'opacity-70')} />
 );
}
