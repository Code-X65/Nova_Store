import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon, CubeIcon } from '@heroicons/react/24/outline';

interface RelatedProductsManagerProps {
 productId?: string;
 relatedIds?: string[];
 onChange?: (relatedIds: string[]) => void;
}

export function RelatedProductsManager({ productId, relatedIds = [], onChange }: RelatedProductsManagerProps) {
 const qc = useQueryClient();
 const [searchTerm, setSearchTerm] = useState('');
 
 // Local state for full product objects when in creation mode
 const [localRelatedProducts, setLocalRelatedProducts] = useState<any[]>([]);
 
 // 1. Fetch current related products
 const { data: relatedProducts = [], isLoading: isLoadingRelated } = useQuery({
 queryKey: ['related-products', productId],
 queryFn: async () => {
 const { data } = await api.get(`/products/${productId}/related`);
 return data.data.relatedProducts || [];
 },
 enabled: Boolean(productId),
 });

 // 2. Fetch search results for adding new ones
 const { data: searchResults = [], isFetching: isSearching } = useQuery({
 queryKey: ['products-search', searchTerm],
 queryFn: async () => {
 if (!searchTerm || searchTerm.length < 2) return [];
 const { data } = await api.get('/products', {
 params: { search: searchTerm, limit: 10 }
 });
 return data.data.products || [];
 },
 enabled: searchTerm.length >= 2,
 staleTime: 5000,
 });

 // 3. Add mutation / Local Add
 const handleAdd = async (product: any) => {
 if (!productId) {
 // Local mode
 if (!relatedIds.includes(product.id)) {
 const newIds = [...relatedIds, product.id];
 setLocalRelatedProducts(prev => [...prev, product]);
 onChange?.(newIds);
 }
 setSearchTerm('');
 return;
 }
 
 // API mode
 addMutation.mutate(product.id);
 };

 const addMutation = useMutation({
 mutationFn: async (relatedId: string) => {
 return api.post(`/products/${productId}/related`, { relatedId });
 },
 onMutate: async (relatedId: string) => {
 await qc.cancelQueries({ queryKey: ['related-products', productId] });
 const previous = qc.getQueryData<any[]>(['related-products', productId]);

 if (previous) {
 const productToAdd = searchResults.find((p: any) => p.id === relatedId);
 if (productToAdd) {
 qc.setQueryData(['related-products', productId], [...previous, productToAdd]);
 }
 }
 
 setSearchTerm('');
 return { previous };
 },
 onSuccess: () => {
 toast.success('Related product added');
 },
 onError: (err: any, variables, context) => {
 if (context?.previous) {
 qc.setQueryData(['related-products', productId], context.previous);
 }
 toast.error(err?.response?.data?.message || 'Failed to add related product');
 },
 onSettled: () => {
 qc.invalidateQueries({ queryKey: ['related-products', productId] });
 }
 });

 // 4. Remove mutation / Local Remove
 const handleRemove = async (relatedId: string) => {
 if (!productId) {
 // Local mode
 const newIds = relatedIds.filter(id => id !== relatedId);
 setLocalRelatedProducts(prev => prev.filter(p => p.id !== relatedId));
 onChange?.(newIds);
 return;
 }
 
 // API mode
 removeMutation.mutate(relatedId);
 };

 const removeMutation = useMutation({
 mutationFn: async (relatedId: string) => {
 return api.delete(`/products/${productId}/related/${relatedId}`);
 },
 onMutate: async (relatedId: string) => {
 await qc.cancelQueries({ queryKey: ['related-products', productId] });
 const previous = qc.getQueryData<any[]>(['related-products', productId]);
 if (previous) {
 qc.setQueryData(['related-products', productId], previous.filter(p => p.id !== relatedId));
 }
 return { previous };
 },
 onSuccess: () => {
 toast.success('Related product removed');
 },
 onError: (err: any, variables, context) => {
 if (context?.previous) {
 qc.setQueryData(['related-products', productId], context.previous);
 }
 toast.error(err?.response?.data?.message || 'Failed to remove related product');
 },
 onSettled: () => {
 qc.invalidateQueries({ queryKey: ['related-products', productId] });
 }
 });

 const activeRelatedProducts = productId ? relatedProducts : localRelatedProducts;


 return (
 <div className="space-y-6">
 {/* Search & Add */}
 <div className="relative">
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">
 Find Product to Relate
 </label>
 <div className="relative">
 <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--neu-text)]" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search by name or SKU..."
 className="input pl-9 transition-all"
 />
 {isSearching && (
 <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[var(--neu-accent)] border-t-transparent animate-spin" />
 )}
 </div>

 {/* Dropdown Results */}
 {searchTerm.length >= 2 && searchResults.length > 0 && (
 <div className="absolute z-10 w-full mt-1 bg-[var(--panel-bg)] shadow-[var(--neu-outer)] rounded-lg max-h-60 overflow-y-auto custom-scrollbar">
 {searchResults.map((product: any) => {
 if (product.id === productId) return null;
 if (activeRelatedProducts.some((r: any) => r.id === product.id)) return null;

 return (
 <button
 key={product.id}
 onClick={() => handleAdd(product)}
 disabled={productId ? addMutation.isPending : false}
 className="w-full flex items-center justify-between p-3 hover:bg-white/5 border-none text-left transition-colors"
 >
 <div>
 <p className="text-sm font-medium text-white">{product.name}</p>
 <p className="text-xs text-[var(--neu-text)] font-mono">{product.sku}</p>
 </div>
 <PlusIcon className="w-5 h-5 text-[var(--neu-text)]" />
 </button>
 );
 })}
 </div>
 )}
 </div>

 {/* Current Related Products List */}
 <div>
 <h3 className="text-sm font-bold text-white mb-4 tracking-wider uppercase">
 Current Related Products
 </h3>
 
 {isLoadingRelated ? (
 <div className="flex items-center justify-center py-8">
 <div className="w-6 h-6 rounded-full border-2 border-[var(--neu-accent)] border-t-transparent animate-spin" />
 </div>
 ) : activeRelatedProducts.length > 0 ? (
 <ul className="space-y-3">
 {activeRelatedProducts.map((product: any) => (
 <li key={product.id} className="flex items-center justify-between p-4 bg-[var(--neu-bg)] shadow-[var(--neu-inner)] rounded-xl">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-lg bg-[var(--panel-bg)] shadow-[var(--neu-inner)] flex items-center justify-center overflow-hidden flex-shrink-0">
 {product.thumbnail_url || product.primary_image_url ? (
 <img src={product.thumbnail_url || product.primary_image_url} alt={product.name} className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <CubeIcon className="w-5 h-5 text-[var(--neu-text)]" />
 </div>
 )}
 </div>
 <div>
 <p className="text-sm font-medium text-white">{product.name}</p>
 <p className="text-xs text-[var(--neu-text)] font-mono">{product.sku}</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => handleRemove(product.id)}
 disabled={productId ? removeMutation.isPending : false}
 className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors opacity-0 group-hover:opacity-100"
 title="Remove"
 >
 <TrashIcon className="w-5 h-5" />
 </button>
 </li>
 ))}
 </ul>
 ) : (
 <div className="text-sm text-[var(--neu-text)] py-8 text-center shadow-[var(--neu-inner)] rounded-xl">
 No related products yet. Search and add some above.
 </div>
 )}
 </div>
 </div>
 );
}
