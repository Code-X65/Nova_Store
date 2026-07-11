import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { PlusIcon } from '@heroicons/react/24/outline';

import { BrandsTable, type Brand } from './brands/BrandsTable';
import { BrandForm } from './brands/BrandForm';
import { DeleteBrandModal } from './brands/DeleteBrandModal';

type FormMode =
 | { type: 'create' }
 | { type: 'edit'; brand: Brand };

export default function Brands() {
 const [formMode, setFormMode] = useState<FormMode | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);

 // Filters
 const [activeOnly, setActiveOnly] = useState(false);
 const [featuredOnly, setFeaturedOnly] = useState(false);

 const { data: brands = [], isLoading } = useQuery<Brand[]>({
 queryKey: ['brands', { activeOnly, featuredOnly }],
 queryFn: async () => {
 const params = new URLSearchParams();
 if (activeOnly) params.set('activeOnly', 'true');
 if (featuredOnly) params.set('featuredOnly', 'true');
 
 const { data } = await api.get(`/brands?${params.toString()}`);
 return Array.isArray(data.data) ? data.data : (data.data?.brands || []);
 },
 });

 const totalCount = brands.length;
 const featuredCount = brands.filter(b => b.is_featured).length;
 const activeCount = brands.filter(b => b.is_active).length;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between w-full">
 <div>
 <h1 className="page-title">Brands</h1>
 <p className="text-sm text-[var(--neu-text)] mt-1">
 Manage your store's brands and manufacturers.
 </p>
 </div>
 <button
 onClick={() => setFormMode({ type: 'create' })}
 className="btn-primary flex items-center gap-2"
 >
 <PlusIcon className="w-4 h-4" />
 New Brand
 </button>
 </div>



 {/* Main Panel */}
 <div className="glass-card rounded-2xl overflow-hidden w-full">
 {/* Toolbar */}
  <div className="px-6 py-4 flex items-center justify-between">
  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
 Brand Directory
 </p>
 
 <div className="flex items-center gap-4">
 <label className="flex items-center gap-2 cursor-pointer group">
 <input
 type="checkbox"
 checked={activeOnly}
 onChange={e => setActiveOnly(e.target.checked)}
 className="w-3.5 h-3.5 rounded border-[var(--panel-border)] text-[var(--neu-accent)] focus:ring-[var(--neu-accent)] bg-[var(--neu-bg)] cursor-pointer"
 />
 <span className="text-xs text-[var(--neu-text)] group-hover:text-white transition-colors">Active Only</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer group">
 <input
 type="checkbox"
 checked={featuredOnly}
 onChange={e => setFeaturedOnly(e.target.checked)}
 className="w-3.5 h-3.5 rounded border-[var(--panel-border)] text-[var(--neu-accent)] focus:ring-[var(--neu-accent)] bg-[var(--neu-bg)] cursor-pointer"
 />
 <span className="text-xs text-[var(--neu-text)] group-hover:text-white transition-colors">Featured Only</span>
 </label>
 </div>
 </div>

 {/* Table */}
 <BrandsTable
 brands={brands}
 isLoading={isLoading}
 onEdit={brand => setFormMode({ type: 'edit', brand })}
 onDelete={brand => setDeleteTarget(brand)}
 />
 </div>

 {/* Form Drawer */}
 {formMode && (
 <BrandForm
 mode={formMode}
 onClose={() => setFormMode(null)}
 />
 )}

 {/* Delete Modal */}
 {deleteTarget && (
 <DeleteBrandModal
 brand={deleteTarget}
 onClose={() => setDeleteTarget(null)}
 />
 )}
 </div>
 );
}