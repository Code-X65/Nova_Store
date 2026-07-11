import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { CategoryNode } from './useCategoryTree';

interface DeleteCategoryModalProps {
 category: CategoryNode;
 onClose: () => void;
}

export function DeleteCategoryModal({ category, onClose }: DeleteCategoryModalProps) {
 const qc = useQueryClient();
 const [cascade, setCascade] = useState(false);
 const childCount = category.children?.length ?? 0;
 const hasChildren = childCount > 0;

 const deleteMutation = useMutation({
 mutationFn: async () => {
 const url = cascade
 ? `/categories/${category.id}?cascade=true`
 : `/categories/${category.id}`;
 return api.delete(url);
 },
 onMutate: async () => {
 await qc.cancelQueries({ queryKey: ['categories', 'tree'] });
 const previousTree = qc.getQueryData<CategoryNode[]>(['categories', 'tree']);
 if (previousTree) {
 const removeNode = (nodes: CategoryNode[]): CategoryNode[] => {
 return nodes
 .filter(n => n.id !== category.id)
 .map(n => ({
 ...n,
 children: n.children ? removeNode(n.children) : []
 }));
 };
 qc.setQueryData(['categories', 'tree'], removeNode(previousTree));
 }
 onClose(); // instantly close modal
 return { previousTree };
 },
 onSuccess: () => {
 toast.success(`"${category.name}" deleted`);
 },
 onError: (err: any, variables, context) => {
 if (context?.previousTree) {
 qc.setQueryData(['categories', 'tree'], context.previousTree);
 }
 toast.error(err?.response?.data?.message ?? 'Failed to delete category');
 },
 onSettled: () => {
 qc.invalidateQueries({ queryKey: ['categories', 'tree'] });
 },
 });

 const canDelete = !hasChildren || cascade;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

 {/* Modal */}
 <div className="relative z-10 w-full max-w-md glass-card p-6 space-y-5 animate-in zoom-in-95 duration-150">
 {/* Icon + title */}
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center flex-shrink-0">
 <TrashIcon className="w-5 h-5 text-red-400" />
 </div>
 <div>
 <h3 className="text-base font-bold text-white">Delete Category</h3>
 <p className="text-sm text-[var(--neu-text)] mt-1">
 You are about to delete <span className="text-white font-semibold">"{category.name}"</span>.
 </p>
 </div>
 </div>

 {/* Meta info */}
 <div className="grid grid-cols-3 gap-3">
 {[
 ['Level', `L${category.level}`],
 ['Products', category.product_count],
 ['Subcategories', childCount],
 ].map(([label, val]) => (
 <div key={label as string} className="bg-[var(--neu-bg)] rounded-lg px-3 py-2 text-center border border-[var(--panel-border)]">
 <p className="text-[10px] text-[var(--neu-text)] font-bold uppercase tracking-wider">{label}</p>
 <p className="text-lg font-bold text-white mt-0.5">{val}</p>
 </div>
 ))}
 </div>

 {/* Children warning + cascade option */}
 {hasChildren && (
 <div className="space-y-3">
 <div className="flex items-start gap-2 p-3 bg-amber-400/10 border border-amber-400/30 rounded-lg">
 <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-amber-300">
 This category has <strong>{childCount} direct subcategor{childCount === 1 ? 'y' : 'ies'}</strong>.
 You must either delete them first or enable cascade delete below.
 </p>
 </div>

 <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
 border-red-400/20 hover:border-red-400/40 hover:bg-red-400/5">
 <input
 type="checkbox"
 checked={cascade}
 onChange={e => setCascade(e.target.checked)}
 className="mt-0.5 w-4 h-4 accent-red-400 cursor-pointer flex-shrink-0"
 />
 <div>
 <p className="text-sm font-semibold text-red-400">Also delete all subcategories</p>
 <p className="text-xs text-[var(--neu-text)] mt-0.5">
 This will permanently archive <strong>all descendant categories</strong>. This cannot be undone.
 </p>
 </div>
 </label>
 </div>
 )}

 {/* No children — simple warning */}
 {!hasChildren && (
 <p className="text-sm text-[var(--neu-text)]">
 This action is irreversible. The category will be soft-archived and removed from all product listings.
 </p>
 )}

 {/* Actions */}
 <div className="flex items-center justify-end gap-3 pt-1">
 <button
 type="button"
 onClick={onClose}
 disabled={deleteMutation.isPending}
 className="btn-secondary text-sm px-5 py-2"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={() => deleteMutation.mutate()}
 disabled={deleteMutation.isPending || !canDelete}
 className="btn-danger text-sm px-5 py-2 disabled:opacity-40"
 >
 {deleteMutation.isPending ? 'Deleting…' : cascade ? 'Delete & Cascade' : 'Delete'}
 </button>
 </div>
 </div>
 </div>
 );
}
