import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useCategoryTree, type CategoryNode } from './categories/useCategoryTree';
import { CategoryTree, CategoryTreeSkeleton } from './categories/CategoryTree';
import { CategoryForm } from './categories/CategoryForm';
import { DeleteCategoryModal } from './categories/DeleteCategoryModal';
import { BulkCreatePanel } from './categories/BulkCreatePanel';
import { AttributeManager } from './categories/AttributeManager';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { reorderCategories } from './api/categories';
import { PermissionGuard } from '@/admin/components/guards/PermissionGuard';

type FormMode =
 | { type: 'create' }
 | { type: 'createChild'; parentId: string }
 | { type: 'edit'; category: CategoryNode };

export default function Categories() {
 const { data: tree = [], isLoading } = useCategoryTree();

 const [formMode, setFormMode] = useState<FormMode | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
 const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);
 const qc = useQueryClient();

 const reorderMutation = useMutation({
 mutationFn: async (updates: { id: string; sort_order: number }[]) => {
 return reorderCategories(updates);
 },
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['categories', 'tree'] });
 },
 onError: (err: any) => {
 toast.error(err?.response?.data?.message || 'Failed to reorder categories');
 }
 });

 const handleMove = (node: CategoryNode, direction: 'up' | 'down', siblings: CategoryNode[]) => {
 const index = siblings.findIndex(s => s.id === node.id);
 if (index === -1) return;
 
 if (direction === 'up' && index === 0) return;
 if (direction === 'down' && index === siblings.length - 1) return;

 const newIndex = direction === 'up' ? index - 1 : index + 1;
 const newSiblings = [...siblings];
 
 // Swap
 [newSiblings[index], newSiblings[newIndex]] = [newSiblings[newIndex], newSiblings[index]];
 
 // Generate updates payload
 const updates = newSiblings.map((s, i) => ({
 id: s.id,
 sort_order: i
 }));

 // Optimistic update in UI
 qc.cancelQueries({ queryKey: ['categories', 'tree'] });
 const previousTree = qc.getQueryData<CategoryNode[]>(['categories', 'tree']);
 
 if (previousTree) {
 const updateTree = (nodes: CategoryNode[]): CategoryNode[] => {
 if (nodes.some(n => n.id === node.id)) {
 return newSiblings; // Replace the array at this level with our sorted array
 }
 return nodes.map(n => ({
 ...n,
 children: updateTree(n.children || [])
 }));
 };
 qc.setQueryData(['categories', 'tree'], updateTree(previousTree));
 }

 reorderMutation.mutate(updates, {
 onError: (err) => {
 if (previousTree) {
 qc.setQueryData(['categories', 'tree'], previousTree);
 }
 toast.error(err?.response?.data?.message || 'Failed to reorder categories');
 }
 });
 };

 // Counts for the header stat bar
 const countAll = (nodes: CategoryNode[]): number =>
 nodes.reduce((acc, n) => acc + 1 + countAll(n.children ?? []), 0);
 const total = countAll(tree);
 const active = (() => {
 const flat: CategoryNode[] = [];
 const walk = (ns: CategoryNode[]) => ns.forEach(n => { flat.push(n); walk(n.children ?? []); });
 walk(tree);
 return flat.filter(n => n.is_active).length;
 })();

 const handleSelect = (cat: CategoryNode) => {
 // Toggle: clicking the already-selected category deselects
 setSelectedCategory(prev => prev?.id === cat.id ? null : cat);
 };

 const showAttributes = Boolean(selectedCategory);

 return (
 <div className="space-y-6">
 {/* Page header */}
  <div className="flex items-start justify-between ">
  <div>
  <h1 className="page-title">Categories</h1>
  <p className="text-sm text-[var(--neu-text)] mt-1">
  Manage your product classification tree.
  {!showAttributes && <span className="opacity-60"> Click a category to manage its attributes.</span>}
  </p>
  </div>
  <PermissionGuard permission="category:manage">
  <button
  onClick={() => setFormMode({ type: 'create' })}
  className="btn-primary flex items-center gap-2"
  >
  <PlusIcon className="w-4 h-4" />
  New Category
  </button>
  </PermissionGuard>
  </div>



 {/* Main area: Tree */}
 <div className="">
 <div className="glass-card rounded-2xl overflow-hidden">
 <div className="px-6 py-4 flex items-center justify-between">
 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
 Category Hierarchy
 </p>
 <p className="text-xs text-[var(--neu-text)]">
 {showAttributes
 ? <span className="text-[var(--neu-accent)]">↑ {selectedCategory?.name}</span>
 : 'Click row for attributes'}
 </p>
 </div>

 {isLoading ? (
 <CategoryTreeSkeleton />
 ) : (
 <CategoryTree
 nodes={tree}
 onEdit={cat => setFormMode({ type: 'edit', category: cat })}
 onAddChild={parentId => setFormMode({ type: 'createChild', parentId })}
 onDelete={cat => setDeleteTarget(cat)}
 onSelect={handleSelect}
 onMove={handleMove}
 selectedId={selectedCategory?.id}
 />
 )}
 </div>

 </div>

 {/* Bulk import — below tree */}
 <div className="max-w-4xl mt-4">
 <BulkCreatePanel />
 </div>

 {/* Attribute manager drawer */}
 {showAttributes && selectedCategory && (
 <AttributeManager
 categoryId={selectedCategory.id}
 categoryName={selectedCategory.name}
 onClose={() => setSelectedCategory(null)}
 />
 )}

 {/* Form drawer */}
 {formMode && (
 <CategoryForm
 mode={formMode}
 onClose={() => setFormMode(null)}
 />
 )}

 {/* Delete modal */}
 {deleteTarget && (
 <DeleteCategoryModal
 category={deleteTarget}
 onClose={() => setDeleteTarget(null)}
 />
 )}
 </div>
 );
}