import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { ImageUploadInput } from '@/admin/components/ui/ImageUploadInput';
import type { Brand } from './BrandsTable';

type FormMode =
 | { type: 'create' }
 | { type: 'edit'; brand: Brand };

interface BrandFormProps {
 mode: FormMode;
 onClose: () => void;
}

interface FormState {
 name: string;
 description: string;
 logo_url: string;
 thumbnail_url: string;
 banner_url: string;
 website_url: string;
 is_active: boolean;
 is_featured: boolean;
 meta_title: string;
 meta_description: string;
 meta_keywords: string;
}

const empty: FormState = {
 name: '',
 description: '',
 logo_url: '',
 thumbnail_url: '',
 banner_url: '',
 website_url: '',
 is_active: true,
 is_featured: false,
 meta_title: '',
 meta_description: '',
 meta_keywords: '',
};

function slugPreview(name: string): string {
 return name
 .toLowerCase()
 .replace(/[^a-z0-9\s-]/g, '')
 .replace(/\s+/g, '-')
 .replace(/-+/g, '-')
 .slice(0, 80);
}

export function BrandForm({ mode, onClose }: BrandFormProps) {
 const qc = useQueryClient();
 const isEditing = mode.type === 'edit';
 const editId = isEditing ? mode.brand.id : undefined;

 const [form, setForm] = useState<FormState>(empty);
 const [activeTab, setActiveTab] = useState<'core' | 'media' | 'seo'>('core');
 const [conflictError, setConflictError] = useState('');

 useEffect(() => {
 if (mode.type === 'edit') {
 const b = mode.brand;
 setForm({
 name: b.name,
 description: b.description ?? '',
 logo_url: b.logo_url ?? '',
 thumbnail_url: b.thumbnail_url ?? '',
 banner_url: b.banner_url ?? '',
 website_url: b.website_url ?? '',
 is_active: b.is_active,
 is_featured: b.is_featured,
 meta_title: b.meta_title ?? '',
 meta_description: b.meta_description ?? '',
 meta_keywords: (b.meta_keywords ?? []).join(', '),
 });
 } else {
 setForm(empty);
 }
 setActiveTab('core');
 setConflictError('');
 }, [mode]);

 const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
 setForm(prev => ({ ...prev, [key]: val }));
 if (key === 'name') setConflictError(''); // clear error on type
 }, []);

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = {
 name: form.name.trim(),
 description: form.description.trim() || undefined,
 logo_url: form.logo_url.trim() || undefined,
 thumbnail_url: form.thumbnail_url.trim() || undefined,
 banner_url: form.banner_url.trim() || undefined,
 website_url: form.website_url.trim() || undefined,
 is_active: form.is_active,
 is_featured: form.is_featured,
 meta_title: form.meta_title.trim() || undefined,
 meta_description: form.meta_description.trim() || undefined,
 meta_keywords: form.meta_keywords
 ? form.meta_keywords.split(',').map(k => k.trim()).filter(Boolean)
 : undefined,
 };
 if (isEditing && editId) {
 return api.patch(`/brands/${editId}`, payload);
 }
 return api.post('/brands', payload);
 },
 onMutate: async () => {
 await qc.cancelQueries({ queryKey: ['brands'] });
 
 const payload = {
 id: isEditing && editId ? editId : `temp-${Date.now()}`,
 name: form.name.trim(),
 slug: slugPreview(form.name.trim()),
 description: form.description.trim() || null,
 logo_url: form.logo_url.trim() || null,
 thumbnail_url: form.thumbnail_url.trim() || null,
 banner_url: form.banner_url.trim() || null,
 website_url: form.website_url.trim() || null,
 is_active: form.is_active,
 is_featured: form.is_featured,
 meta_title: form.meta_title.trim() || null,
 meta_description: form.meta_description.trim() || null,
 meta_keywords: form.meta_keywords
 ? form.meta_keywords.split(',').map(k => k.trim()).filter(Boolean)
 : null,
 product_count: isEditing ? mode.brand.product_count : 0,
 created_at: isEditing ? mode.brand.created_at : new Date().toISOString(),
 updated_at: new Date().toISOString(),
 };

 // We need to return all previous states to rollback if needed.
 const previousStates = qc.getQueriesData({ queryKey: ['brands'] });

 qc.setQueriesData({ queryKey: ['brands'] }, (oldData: any) => {
 if (!oldData) return [];
 if (isEditing) {
 return oldData.map((b: any) => b.id === editId ? { ...b, ...payload } : b);
 } else {
 return [payload, ...oldData];
 }
 });
 
 onClose(); // instantly close drawer
 return { previousStates };
 },
 onSuccess: () => {
 toast.success(isEditing ? 'Brand updated' : 'Brand created');
 },
 onError: (err: any, variables, context) => {
 if (context?.previousStates) {
 context.previousStates.forEach(([queryKey, data]) => {
 qc.setQueryData(queryKey, data);
 });
 }
 if (err?.response?.status === 409) {
 setConflictError('A brand with this name or slug already exists.');
 setActiveTab('core'); // jump to tab with error
 } else {
 toast.error(err?.response?.data?.message ?? 'Failed to save brand');
 }
 },
 onSettled: () => {
 qc.invalidateQueries({ queryKey: ['brands'] });
 }
 });

 const title = isEditing ? 'Edit Brand' : 'New Brand';
 const tabs = ['core', 'media', 'seo'] as const;

 const inputCls = 'input text-sm py-2 px-3 rounded-lg';
 const labelCls = 'block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5';
 const toggleCls = (active: boolean) =>
 `relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer ${
 active ? 'bg-[var(--neu-accent)]' : 'bg-white/10'
 }`;

 return (
 <div className="fixed inset-0 z-40 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

 {/* Drawer */}
 <div className="relative z-50 w-full max-w-lg h-full bg-[var(--panel-bg)] border-l border-[var(--panel-border)] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
 
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--panel-border)]">
 <div>
 <h2 className="text-lg font-bold text-white">{title}</h2>
 {isEditing && (
 <p className="text-xs text-[var(--neu-text)] mt-0.5 font-mono">/{mode.brand.slug}</p>
 )}
 </div>
 <button onClick={onClose} className="p-2 text-[var(--neu-text)] hover:text-white hover:bg-white/5 rounded-lg transition-colors">
 <XMarkIcon className="w-5 h-5" />
 </button>
 </div>

 {/* Rename notice (edit mode) */}
 {isEditing && form.name !== mode.brand.name && (
 <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2.5 bg-[var(--neu-accent)]/10 border border-[var(--neu-accent)]/30 rounded-lg text-xs text-[var(--neu-accent)]">
 <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
 Renaming will regenerate the slug and change the brand's public URL.
 </div>
 )}

 {/* Tabs */}
 <div className="flex gap-1 px-6 pt-4">
 {tabs.map(tab => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
 activeTab === tab
 ? 'bg-[var(--neu-accent)]/10 text-[var(--neu-accent)] border border-[var(--neu-accent)]/40'
 : 'text-[var(--neu-text)] hover:text-white hover:bg-white/5'
 }`}
 >
 {tab === 'media' ? 'Media & Links' : tab}
 </button>
 ))}
 </div>

 {/* Form body */}
 <form
 id="brand-form"
 onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }}
 className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
 >
 {/* ── CORE TAB ── */}
 {activeTab === 'core' && (
 <div className="space-y-4 animate-in fade-in duration-200">
 <div>
 <label className={labelCls}>Name *</label>
 <input
 type="text"
 required
 minLength={2}
 maxLength={100}
 value={form.name}
 onChange={e => set('name', e.target.value)}
 className={`${inputCls} ${conflictError ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
 placeholder="e.g. Samsung"
 />
 {conflictError ? (
 <p className="mt-1 text-xs text-red-400">{conflictError}</p>
 ) : form.name ? (
 <p className="mt-1 text-[10px] text-[var(--neu-text)] font-mono">
 slug: {slugPreview(form.name)}
 </p>
 ) : null}
 </div>

 <div>
 <label className={labelCls}>Description</label>
 <textarea
 rows={4}
 maxLength={2000}
 value={form.description}
 onChange={e => set('description', e.target.value)}
 className={`${inputCls} resize-none`}
 placeholder="Brand details (up to 2000 characters)"
 />
 <p className="mt-1 text-[10px] text-[var(--neu-text)]">{form.description.length}/2000</p>
 </div>

 {/* Toggles */}
 <div className="flex gap-6 pt-1">
 {([
 ['is_active', 'Active'],
 ['is_featured', 'Featured'],
 ] as const).map(([key, label]) => (
 <label key={key} className="flex items-center gap-3 cursor-pointer">
 <div
 className={toggleCls(form[key])}
 onClick={() => set(key, !form[key])}
 role="switch"
 aria-checked={form[key]}
 >
 <span
 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
 form[key] ? 'translate-x-5' : 'translate-x-0'
 }`}
 />
 </div>
 <span className="text-sm text-white">{label}</span>
 </label>
 ))}
 </div>
 </div>
 )}

 {/* ── MEDIA TAB ── */}
 {activeTab === 'media' && (
 <div className="space-y-4 animate-in fade-in duration-200">
 {[
 { key: 'thumbnail_url', label: 'Thumbnail URL', shape: 'square' },
 ].map(({ key, label, shape }) => {
 const url = form[key as keyof FormState] as string;
 return (
 <div key={key}>
 <label className={labelCls}>{label}</label>
 <ImageUploadInput
 value={url}
 onChange={(val) => set(key as any, val)}
 />
 {url && (
 <div className="mt-2 bg-[var(--neu-bg)] border border-[var(--panel-border)] p-2 rounded-lg inline-block">
 <img
 src={url}
 alt={`${label} preview`}
 className={`object-cover rounded-md ${shape === 'wide' ? 'w-full h-24' : 'w-16 h-16'}`}
 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 </div>
 )}
 </div>
 );
 })}

 <div>
 <label className={labelCls}>Website URL</label>
 <input
 type="url"
 value={form.website_url}
 onChange={e => set('website_url', e.target.value)}
 className={inputCls}
 placeholder="https://..."
 />
 </div>
 </div>
 )}

 {/* ── SEO TAB ── */}
 {activeTab === 'seo' && (
 <div className="space-y-4 animate-in fade-in duration-200">
 <div>
 <label className={labelCls}>Meta Title <span className="normal-case font-normal">(≤60)</span></label>
 <input
 type="text"
 maxLength={60}
 value={form.meta_title}
 onChange={e => set('meta_title', e.target.value)}
 className={inputCls}
 />
 <p className="mt-1 text-[10px] text-[var(--neu-text)]">{form.meta_title.length}/60</p>
 </div>

 <div>
 <label className={labelCls}>Meta Description <span className="normal-case font-normal">(≤160)</span></label>
 <textarea
 rows={3}
 maxLength={160}
 value={form.meta_description}
 onChange={e => set('meta_description', e.target.value)}
 className={`${inputCls} resize-none`}
 />
 <p className="mt-1 text-[10px] text-[var(--neu-text)]">{form.meta_description.length}/160</p>
 </div>

 <div>
 <label className={labelCls}>Keywords <span className="normal-case font-normal">(comma-separated)</span></label>
 <input
 type="text"
 value={form.meta_keywords}
 onChange={e => set('meta_keywords', e.target.value)}
 className={inputCls}
 placeholder="electronics, samsung, galaxy"
 />
 {form.meta_keywords && (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {form.meta_keywords.split(',').map(k => k.trim()).filter(Boolean).map(k => (
 <span key={k} className="badge-muted text-[10px] px-2 py-0.5">{k}</span>
 ))}
 </div>
 )}
 </div>
 </div>
 )}
 </form>

 {/* Footer */}
 <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--panel-border)]">
 <button type="button" onClick={onClose} className="btn-secondary text-sm px-5 py-2">
 Cancel
 </button>
 <button
 type="submit"
 form="brand-form"
 disabled={saveMutation.isPending || !form.name.trim()}
 className="btn-primary text-sm px-5 py-2 disabled:opacity-40"
 >
 {saveMutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Brand'}
 </button>
 </div>

 </div>
 </div>
 );
}
