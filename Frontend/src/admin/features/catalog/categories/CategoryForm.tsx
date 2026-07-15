import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchCategoryById, createCategory, updateCategory } from '../api/categories';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { CategorySelect } from './CategorySelect';
import { ImageUploadInput } from '@/admin/components/ui/ImageUploadInput';
import type { CategoryNode } from './useCategoryTree';
import { PermissionGuard } from '@/admin/components/guards/PermissionGuard';

type FormMode =
 | { type: 'create' }
 | { type: 'createChild'; parentId: string }
 | { type: 'edit'; category: CategoryNode };

interface CategoryFormProps {
 mode: FormMode;
 onClose: () => void;
}

interface FormState {
 name: string;
 parentId: string;
 description: string;
 image_url: string;
 thumbnail_url: string;
 icon: string;
 color: string;
 sort_order: number;
 is_active: boolean;
 is_featured: boolean;
 meta_title: string;
 meta_description: string;
 meta_keywords: string; // comma-separated; split on submit
}

const empty: FormState = {
 name: '',
 parentId: '',
 description: '',
 image_url: '',
 thumbnail_url: '',
 icon: '',
 color: '',
 sort_order: 0,
 is_active: true,
 is_featured: false,
 meta_title: '',
 meta_description: '',
 meta_keywords: '',
};

/** Derive a URL-safe slug preview from a name string. */
function slugPreview(name: string): string {
 return name
 .toLowerCase()
 .replace(/[^a-z0-9\s-]/g, '')
 .replace(/\s+/g, '-')
 .replace(/-+/g, '-')
 .slice(0, 80);
}

export function CategoryForm({ mode, onClose }: CategoryFormProps) {
 const qc = useQueryClient();
 const isEditing = mode.type === 'edit';
 const editId = isEditing ? mode.category.id : undefined;

 // Load full record for edit so we get parent + all fields
 const { data: editData, isLoading: editLoading } = useQuery({
 queryKey: ['category', editId],
 queryFn: async () => {
 return fetchCategoryById(editId as string) as Promise<CategoryNode>;
 },
 enabled: isEditing,
 staleTime: 0,
 });

 const [form, setForm] = useState<FormState>(empty);
 const [activeTab, setActiveTab] = useState<'core' | 'display' | 'seo'>('core');

 // Populate form from fetched data (edit) or defaults (create)
 useEffect(() => {
 if (mode.type === 'edit' && editData) {
 setForm({
 name: editData.name,
 parentId: editData.parent_id ?? '',
 description: editData.description ?? '',
 image_url: editData.image_url ?? '',
 thumbnail_url: editData.thumbnail_url ?? '',
 icon: editData.icon ?? '',
 color: editData.color ?? '',
 sort_order: editData.sort_order ?? 0,
 is_active: editData.is_active,
 is_featured: editData.is_featured,
 meta_title: editData.meta_title ?? '',
 meta_description: editData.meta_description ?? '',
 meta_keywords: (editData.meta_keywords ?? []).join(', '),
 });
 } else if (mode.type === 'createChild') {
 setForm({ ...empty, parentId: mode.parentId });
 } else {
 setForm(empty);
 }
 setActiveTab('core');
 }, [mode, editData]);

 const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
 setForm(prev => ({ ...prev, [key]: val }));
 }, []);

 const invalidate = () => {
 qc.invalidateQueries({ queryKey: ['categories', 'tree'] });
 if (editId) qc.invalidateQueries({ queryKey: ['category', editId] });
 };

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = {
 name: form.name.trim(),
 parentId: form.parentId || null,
 description: form.description.trim() || undefined,
 image_url: form.image_url.trim() || undefined,
 thumbnail_url: form.thumbnail_url.trim() || undefined,
 icon: form.icon.trim() || undefined,
 color: form.color.trim() || undefined,
 sort_order: form.sort_order,
 is_active: form.is_active,
 is_featured: form.is_featured,
 meta_title: form.meta_title.trim() || undefined,
 meta_description: form.meta_description.trim() || undefined,
 meta_keywords: form.meta_keywords
 ? form.meta_keywords.split(',').map(k => k.trim()).filter(Boolean)
 : undefined,
 };
 if (isEditing && editId) {
 return updateCategory(editId, payload);
 }
 return createCategory(payload);
 },
 onMutate: async () => {
 await qc.cancelQueries({ queryKey: ['categories', 'tree'] });
 const previousTree = qc.getQueryData<CategoryNode[]>(['categories', 'tree']);
 
 if (previousTree) {
 const payloadNode: CategoryNode = {
 id: isEditing && editId ? editId : `temp-${Date.now()}`,
 name: form.name.trim(),
 parent_id: form.parentId || null,
 description: form.description.trim() || null,
 image_url: form.image_url.trim() || null,
 thumbnail_url: form.thumbnail_url.trim() || null,
 icon: form.icon.trim() || null,
 color: form.color.trim() || null,
 sort_order: form.sort_order,
 is_active: form.is_active,
 is_featured: form.is_featured,
 meta_title: form.meta_title.trim() || null,
 meta_description: form.meta_description.trim() || null,
 meta_keywords: form.meta_keywords
 ? form.meta_keywords.split(',').map(k => k.trim()).filter(Boolean)
 : null,
 product_count: isEditing ? (editData?.product_count ?? 0) : 0,
 level: isEditing ? (editData?.level ?? 0) : 0, // naive level
 path: isEditing ? (editData?.path ?? '') : '',
 children: isEditing ? (editData?.children ?? []) : []
 };

 const updateTree = (nodes: CategoryNode[]): CategoryNode[] => {
 if (isEditing) {
 // 1. We might have changed parentId. Simplest optimistic is just to update in place for now.
 // A perfect optimistic reparent is complex, so we'll just update its props in place if parent didn't change,
 // otherwise we wait for server to refetch.
 return nodes.map(n => {
 if (n.id === payloadNode.id) return { ...n, ...payloadNode };
 return { ...n, children: n.children ? updateTree(n.children) : [] };
 });
 } else {
 // Create mode
 if (!payloadNode.parent_id) {
 return [...nodes, payloadNode];
 }
 return nodes.map(n => {
 if (n.id === payloadNode.parent_id) {
 return { ...n, children: [...(n.children || []), payloadNode] };
 }
 return { ...n, children: n.children ? updateTree(n.children) : [] };
 });
 }
 };

 qc.setQueryData(['categories', 'tree'], updateTree(previousTree));
 }
 onClose(); // Instantly close form
 return { previousTree };
 },
 onSuccess: () => {
 toast.success(isEditing ? 'Category updated' : 'Category created');
 },
 onError: (err: any, variables, context) => {
 if (context?.previousTree) {
 qc.setQueryData(['categories', 'tree'], context.previousTree);
 }
 toast.error(err?.response?.data?.message ?? 'Failed to save category');
 },
 onSettled: () => {
 invalidate();
 },
 });

 const title = isEditing
 ? 'Edit Category'
 : mode.type === 'createChild'
 ? 'Add Subcategory'
 : 'New Category';

 const inputCls =
 'input text-sm py-2 px-3 rounded-lg';
 const labelCls = 'block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5';
 const toggleCls = (active: boolean) =>
 `relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer ${
 active ? 'bg-[var(--neu-accent)]' : 'bg-white/10'
 }`;

 const tabs = ['core', 'display', 'seo'] as const;

 return (
 /* Drawer overlay */
 <div className="fixed inset-0 z-40 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

 {/* Drawer panel */}
 <div className="relative z-50 w-full max-w-lg h-full bg-[var(--panel-bg)] border-l border-[var(--panel-border)] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--panel-border)]">
 <div>
 <h2 className="text-lg font-bold text-white">{title}</h2>
 {isEditing && (
 <p className="text-xs text-[var(--neu-text)] mt-0.5 font-mono">/{slugPreview(form.name)}</p>
 )}
 </div>
 <button onClick={onClose} className="p-2 text-[var(--neu-text)] hover:text-white hover:bg-white/5 rounded-lg transition-colors">
 <XMarkIcon className="w-5 h-5" />
 </button>
 </div>

 {/* Rename notice (edit mode) */}
 {isEditing && form.name !== (editData?.name ?? '') && (
 <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2.5 bg-[var(--neu-accent)]/10 border border-[var(--neu-accent)]/30 rounded-lg text-xs text-[var(--neu-accent)]">
 <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
 Renaming will regenerate the slug.
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
 {tab}
 </button>
 ))}
 </div>

 {/* Form body */}
 {isEditing && editLoading ? (
 <div className="flex-1 flex items-center justify-center">
 <div className="w-8 h-8 rounded-full border-2 border-[var(--neu-accent)] border-t-transparent animate-spin" />
 </div>
 ) : (
 <form
 id="category-form"
 onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }}
 className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
 >
 {/* ── CORE TAB ── */}
 {activeTab === 'core' && (
 <div className="space-y-4">
 <div>
 <label className={labelCls}>Name *</label>
 <input
 type="text"
 required
 minLength={2}
 maxLength={50}
 value={form.name}
 onChange={e => set('name', e.target.value)}
 className={inputCls}
 placeholder="e.g. Electronics"
 />
 {form.name && (
 <p className="mt-1 text-[10px] text-[var(--neu-text)] font-mono">
 slug: {slugPreview(form.name)}
 </p>
 )}
 </div>

 <div>
 <label className={labelCls}>Parent Category</label>
 <CategorySelect
 value={form.parentId}
 onChange={v => set('parentId', v)}
 excludeSubtreeOf={editId}
 placeholder="Root level (no parent)"
 />
 {isEditing && form.parentId !== (editData?.parent_id ?? '') && (
 <p className="mt-1 text-[10px] text-[var(--neu-accent)] flex items-center gap-1">
 <InformationCircleIcon className="w-3 h-3" />
 Reparenting recomputes level and path for this subtree.
 </p>
 )}
 </div>

 <div>
 <label className={labelCls}>Description</label>
 <textarea
 rows={3}
 minLength={10}
 maxLength={500}
 value={form.description}
 onChange={e => set('description', e.target.value)}
 className={`${inputCls} resize-none`}
 placeholder="Brief description (10–500 characters)"
 />
 <p className="mt-1 text-[10px] text-[var(--neu-text)]">{form.description.length}/500</p>
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

 <div>
 <label className={labelCls}>Sort Order</label>
 <input
 type="number"
 min={0}
 value={form.sort_order}
 onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
 className={`${inputCls} w-32`}
 />
 </div>
 </div>
 )}

 {/* ── DISPLAY TAB ── */}
 {activeTab === 'display' && (
 <div className="space-y-4">
 <div>
 <label className={labelCls}>Thumbnail URL</label>
 <ImageUploadInput
 value={form.thumbnail_url}
 onChange={val => set('thumbnail_url', val)}
 placeholder="https://..."
 />
 {form.thumbnail_url && (
 <img src={form.thumbnail_url} alt="preview" className="mt-2 h-20 w-auto rounded-lg object-cover border border-[var(--panel-border)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
 )}
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className={labelCls}>Icon (text, ≤50)</label>
 <input
 type="text"
 maxLength={50}
 value={form.icon}
 onChange={e => set('icon', e.target.value)}
 className={inputCls}
 placeholder="laptop, 💻, icon-name…"
 />
 </div>
 <div>
 <label className={labelCls}>Colour</label>
 <div className="flex items-center gap-2">
 <input
 type="color"
 value={/^#[0-9A-Fa-f]{6}$/.test(form.color || '') ? form.color : '#000000'}
 onChange={e => set('color', e.target.value)}
 className="w-10 h-9 rounded-lg border border-[var(--panel-border)] bg-transparent cursor-pointer p-0.5"
 />
 <input
 type="text"
 maxLength={50}
 value={form.color}
 onChange={e => set('color', e.target.value)}
 className={`${inputCls} flex-1`}
 placeholder="#FF6A1C or red"
 />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ── SEO TAB ── */}
 {activeTab === 'seo' && (
 <div className="space-y-4">
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
 placeholder="electronics, gadgets, tech"
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
 )}

  {/* Footer */}
  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--panel-border)]">
  <button type="button" onClick={onClose} className="btn-secondary text-sm px-5 py-2">
  Cancel
  </button>
  <PermissionGuard permission="category:write" anyOf={['category:manage']}>
  <button
  type="submit"
  form="category-form"
  disabled={saveMutation.isPending || !form.name.trim()}
  className="btn-primary text-sm px-5 py-2"
  >
  {saveMutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Category'}
  </button>
  </PermissionGuard>
  </div>
 </div>
 </div>
 );
}
