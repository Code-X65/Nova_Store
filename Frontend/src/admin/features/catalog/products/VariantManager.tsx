import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ImageUploadInput } from '@/admin/components/ui/ImageUploadInput';

interface VariantManagerProps {
 productId?: string;
 variants: any[];
 onChange: (variants: any[]) => void;
}

export function VariantManager({ productId, variants, onChange }: VariantManagerProps) {
 const qc = useQueryClient();
 const [editingVariant, setEditingVariant] = useState<any | null>(null);
 const [isModalOpen, setIsModalOpen] = useState(false);

 const [form, setForm] = useState({
 sku: '',
 name: '',
 option_values: '',
 price_modifier: 0,
 sale_price: 0,
 stock_quantity: 0,
 image_url: ''
 });

 const openNew = () => {
 setForm({
 sku: '',
 name: '',
 option_values: '{}',
 price_modifier: 0,
 sale_price: 0,
 stock_quantity: 0,
 image_url: ''
 });
 setEditingVariant(null);
 setIsModalOpen(true);
 };

 const openEdit = (variant: any) => {
 setForm({
 sku: variant.sku,
 name: variant.name,
 option_values: typeof variant.option_values === 'string' ? variant.option_values : JSON.stringify(variant.option_values, null, 2),
 price_modifier: variant.price_modifier || 0,
 sale_price: variant.sale_price || 0,
 stock_quantity: variant.stock_quantity || 0,
 image_url: variant.image_url || ''
 });
 setEditingVariant(variant);
 setIsModalOpen(true);
 };

 const saveMutation = useMutation({
 mutationFn: async (payload: any) => {
 if (!productId) {
 // Create Mode (local only)
 if (editingVariant) {
 return { isLocal: true, isEdit: true, variant: payload };
 } else {
 return { isLocal: true, isEdit: false, variant: { ...payload, id: Math.random().toString() } };
 }
 } else {
 // Edit Mode (API directly)
 if (editingVariant && editingVariant.id) {
 const { data } = await api.put(`/products/${productId}/variants/${editingVariant.id}`, payload);
 return { isLocal: false, isEdit: true, variant: data.data?.variant || payload };
 } else {
 const { data } = await api.post(`/products/${productId}/variants`, payload);
 return { isLocal: false, isEdit: false, variant: data.data?.variant || payload };
 }
 }
 },
 onMutate: async (payload: any) => {
 let previousVariants = [...variants];
 let optimisticVariant = { ...payload };

 if (!productId) {
 optimisticVariant.id = editingVariant ? editingVariant.id : `temp-${Math.random()}`;
 } else {
 optimisticVariant.id = editingVariant ? editingVariant.id : `temp-${Date.now()}`;
 }

 let newVariants;
 if (editingVariant) {
 newVariants = variants.map(v => 
 (v.id === editingVariant?.id || v.sku === editingVariant?.sku) ? { ...v, ...optimisticVariant } : v
 );
 } else {
 newVariants = [...variants, optimisticVariant];
 }

 onChange(newVariants);
 setIsModalOpen(false);
 
 return { previousVariants };
 },
 onSuccess: (result) => {
 // For api calls, replace temp id with real id from backend by updating parent state again
 if (!result.isLocal) {
 let finalVariants;
 if (result.isEdit) {
 finalVariants = variants.map(v => 
 (v.id === editingVariant?.id || v.sku === editingVariant?.sku) ? { ...v, ...result.variant } : v
 );
 } else {
 // Swap temp variant for real variant
 finalVariants = variants.map(v => v.sku === result.variant.sku ? result.variant : v);
 }
 onChange(finalVariants);
 setEditingVariant(null);
 toast.success(result.isEdit ? 'Variant updated' : 'Variant added');
 } else {
 setEditingVariant(null);
 }
 },
 onError: (err: any, variables, context) => {
 if (context?.previousVariants) {
 onChange(context.previousVariants);
 }
 toast.error(err?.response?.data?.message || 'Failed to save variant');
 },
 onSettled: () => {
 if (productId) {
 qc.invalidateQueries({ queryKey: ['product', productId] });
 }
 }
 });

 const deleteMutation = useMutation({
 mutationFn: async (variantId: string) => {
 if (!productId) return variantId;
 await api.delete(`/products/${productId}/variants/${variantId}`);
 return variantId;
 },
 onMutate: async (variantId: string) => {
 const previousVariants = [...variants];
 onChange(variants.filter(v => v.id !== variantId));
 return { previousVariants };
 },
 onSuccess: (variantId) => {
 if (productId) {
 toast.success('Variant removed');
 }
 },
 onError: (err: any, variables, context) => {
 if (context?.previousVariants) {
 onChange(context.previousVariants);
 }
 toast.error(err?.response?.data?.message || 'Failed to delete variant');
 },
 onSettled: () => {
 if (productId) {
 qc.invalidateQueries({ queryKey: ['product', productId] });
 }
 }
 });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const parsedOptions = JSON.parse(form.option_values);
 saveMutation.mutate({
 ...form,
 option_values: parsedOptions,
 price_modifier: Number(form.price_modifier),
 sale_price: Number(form.sale_price) || null,
 stock_quantity: Number(form.stock_quantity)
 });
 } catch (e) {
 toast.error('Option values must be valid JSON');
 }
 };

 return (
 <div className="space-y-4">
 <div className="flex justify-between items-center mb-4">
 <p className="text-sm text-[var(--neu-text)]">
 Manage product variations such as sizes, colors, or materials.
 </p>
 <button type="button" onClick={openNew} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
 <PlusIcon className="w-4 h-4" /> Add Variant
 </button>
 </div>

 {variants.length > 0 ? (
 <div className="overflow-x-auto rounded-xl shadow-[var(--neu-inner)] bg-[var(--neu-bg)]">
 <table className="w-full text-left text-sm">
 <thead className="bg-[var(--panel-bg)] text-[var(--neu-text)] uppercase text-xs tracking-wider">
 <tr>
 <th className="px-4 py-3">Variant</th>
 <th className="px-4 py-3">SKU</th>
 <th className="px-4 py-3">Stock</th>
 <th className="px-4 py-3">Price Mod</th>
 <th className="px-4 py-3 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--panel-border)]">
 {variants.map((v, i) => (
 <tr key={v.id || i} className="hover:bg-[var(--panel-bg)]/50 transition-colors">
 <td className="px-4 py-3 font-medium text-white flex items-center gap-3">
 {v.image_url ? (
 <img src={v.image_url} alt="" className="w-8 h-8 rounded-md object-cover shadow-[var(--neu-inner-sm)]" />
 ) : (
 <div className="w-8 h-8 rounded-md bg-[var(--panel-bg)] shadow-[var(--neu-inner-sm)] flex items-center justify-center">
 )}
 {v.name}
 </td>
 <td className="px-4 py-3 text-[var(--neu-text)]">{v.sku}</td>
 <td className="px-4 py-3 text-[var(--neu-text)]">{v.stock_quantity}</td>
 <td className="px-4 py-3 text-[var(--neu-text)] text-green-400">
 {v.price_modifier ? (Number(v.price_modifier) > 0 ? `+${v.price_modifier}` : v.price_modifier) : '—'}
 </td>
 <td className="px-4 py-3 text-right space-x-2">
 <button type="button" onClick={() => openEdit(v)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
 <PencilIcon className="w-4 h-4" />
 </button>
 <button type="button" onClick={() => {
 if (confirm('Delete this variant?')) deleteMutation.mutate(v.id);
 }} 
 className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
 >
 <TrashIcon className="w-4 h-4" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-center py-10 shadow-[var(--neu-inner)] rounded-xl text-[var(--neu-text)] text-sm">
 No variants added.
 </div>
 )}

 {/* Modal Overlay */}
 {isModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
 <div className="bg-[var(--panel-bg)] rounded-2xl shadow-[var(--neu-outer)] w-full max-w-lg mx-4 overflow-hidden border-none">
 <div className="flex items-center justify-between p-6 shadow-[var(--neu-outer-sm)] mb-2">
 <h3 className="text-lg font-bold text-white">{editingVariant ? 'Edit Variant' : 'Add Variant'}</h3>
 <button onClick={() => setIsModalOpen(false)} className="text-[var(--neu-text)] hover:text-white transition-colors">
 <XMarkIcon className="w-6 h-6" />
 </button>
 </div>
 
 <form onSubmit={handleSubmit} className="p-6 space-y-5">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">Variant Name</label>
 <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="e.g. Size L - Red" />
 </div>
 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">SKU</label>
 <input required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="input-field" placeholder="Unique SKU" />
 </div>
 </div>

 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">Option Values (JSON)</label>
 <textarea required value={form.option_values} onChange={e => setForm({...form, option_values: e.target.value})} className="input-field font-mono text-sm" rows={3} placeholder='{"size":"L","color":"Red"}' />
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">Price Modifier</label>
 <input type="number" step="0.01" value={form.price_modifier} onChange={e => setForm({...form, price_modifier: Number(e.target.value)})} className="input-field" />
 </div>
 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">Sale Price</label>
 <input type="number" step="0.01" value={form.sale_price} onChange={e => setForm({...form, sale_price: Number(e.target.value)})} className="input-field" placeholder="Optional override" />
 </div>
 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">Stock</label>
 <input type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: Number(e.target.value)})} className="input-field" />
 </div>
 </div>

 <div>
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">Image URL</label>
 <ImageUploadInput value={form.image_url} onChange={(url) => setForm({...form, image_url: url})} placeholder="Variant specific image" />
 </div>

 <div className="flex justify-end gap-3 pt-6">
 <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">Cancel</button>
 <button type="submit" disabled={saveMutation.isPending} className="btn-primary px-6">
 {saveMutation.isPending ? 'Saving...' : 'Save Variant'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
