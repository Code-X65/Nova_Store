import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { CategorySelect } from '../categories/CategorySelect';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

export interface ProductFilters {
 search: string;
 category_id: string;
 brand_id: string;
 status: string;
 minPrice: string;
 maxPrice: string;
}

interface ProductsFilterBarProps {
 filters: ProductFilters;
 onChange: (filters: ProductFilters) => void;
}

export function ProductsFilterBar({ filters, onChange }: ProductsFilterBarProps) {
 const [localSearch, setLocalSearch] = useState(filters.search);
 const [showAdvanced, setShowAdvanced] = useState(false);

 // Debounce search input
 useEffect(() => {
 const t = setTimeout(() => {
 onChange({ ...filters, search: localSearch });
 }, 400);
 return () => clearTimeout(t);
 }, [localSearch]);

 const { data: brandsData } = useQuery({
 queryKey: ['brands', { activeOnly: true }],
 queryFn: async () => {
 const { data } = await api.get('/brands?activeOnly=true');
 return Array.isArray(data.data) ? data.data : (data.data?.brands || []);
 }
 });

 const { data: priceRange } = useQuery({
 queryKey: ['products-price-range'],
 queryFn: async () => {
 const { data } = await api.get('/products/price-range');
 return data.data; // { min, max }
 }
 });

 const update = (key: keyof ProductFilters, val: string) => {
 onChange({ ...filters, [key]: val });
 };

 const clearFilters = () => {
 setLocalSearch('');
 onChange({
 search: '',
 category_id: '',
 brand_id: '',
 status: '',
 minPrice: '',
 maxPrice: '',
 });
 };

 const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && Boolean(v)).length;

 const inputCls ="bg-[var(--neu-bg)] border border-[var(--panel-border)] rounded-lg px-3 py-1.5 text-sm text-white focus:border-[var(--neu-accent)] focus:ring-1 focus:ring-[var(--neu-accent)] transition-all";
 const labelCls ="block text-[10px] font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1";

 return (
 <div className="glass-card p-4 rounded-xl border border-[var(--panel-border)] space-y-4">
 {/* Top row: Search + toggles */}
 <div className="flex items-center gap-3">
 <div className="relative flex-1 max-w-md">
 <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--neu-text)]" />
 <input
 type="text"
 placeholder="Search products by name or SKU..."
 value={localSearch}
 onChange={e => setLocalSearch(e.target.value)}
 className="w-full bg-[var(--neu-bg)] border border-[var(--panel-border)] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-[var(--neu-accent)] focus:ring-1 focus:ring-[var(--neu-accent)] transition-all"
 />
 </div>

 <button
 onClick={() => setShowAdvanced(!showAdvanced)}
 className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border ${
 showAdvanced || activeFilterCount > 0
 ? 'bg-[var(--neu-accent)]/10 text-[var(--neu-accent)] border-[var(--neu-accent)]/30'
 : 'bg-transparent text-[var(--neu-text)] border-[var(--panel-border)] hover:bg-white/5 hover:text-white'
 }`}
 >
 <FunnelIcon className="w-4 h-4" />
 Filters
 {activeFilterCount > 0 && (
 <span className="bg-[var(--neu-accent)] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
 {activeFilterCount}
 </span>
 )}
 </button>

 {(localSearch || activeFilterCount > 0) && (
 <button
 onClick={clearFilters}
 className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-[var(--neu-text)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
 >
 <XMarkIcon className="w-4 h-4" />
 Clear
 </button>
 )}
 </div>

 {/* Advanced filters */}
 {showAdvanced && (
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--panel-border)] animate-in fade-in slide-in-from-top-2 duration-200">
 <div>
 <label className={labelCls}>Category</label>
 <CategorySelect
 id="filter-cat"
 value={filters.category_id}
 onChange={v => update('category_id', v)}
 placeholder="All Categories"
 />
 </div>

 <div>
 <label className={labelCls}>Brand</label>
 <select
 value={filters.brand_id}
 onChange={e => update('brand_id', e.target.value)}
 className={`${inputCls} w-full`}
 >
 <option value="">All Brands</option>
 {brandsData?.map((b: any) => (
 <option key={b.id} value={b.id}>{b.name}</option>
 ))}
 </select>
 </div>

 <div>
 <label className={labelCls}>Status</label>
 <select
 value={filters.status}
 onChange={e => update('status', e.target.value)}
 className={`${inputCls} w-full`}
 >
 <option value="">All Statuses</option>
 <option value="published">Published</option>
 <option value="draft">Draft</option>
 <option value="archived">Archived</option>
 </select>
 </div>

 <div>
 <label className={labelCls}>
 Price Range {priceRange ? `($${priceRange.min} - $${priceRange.max})` : ''}
 </label>
 <div className="flex items-center gap-2">
 <input
 type="number"
 placeholder="Min"
 value={filters.minPrice}
 onChange={e => update('minPrice', e.target.value)}
 className={`${inputCls} w-full`}
 />
 <span className="text-[var(--neu-text)]">-</span>
 <input
 type="number"
 placeholder="Max"
 value={filters.maxPrice}
 onChange={e => update('maxPrice', e.target.value)}
 className={`${inputCls} w-full`}
 />
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
