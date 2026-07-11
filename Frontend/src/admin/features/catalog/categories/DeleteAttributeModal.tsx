import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { AttributeTemplate } from './AttributeForm';

interface DeleteAttributeModalProps {
 attribute: AttributeTemplate;
 categoryId: string;
 onClose: () => void;
}

export function DeleteAttributeModal({ attribute, categoryId, onClose }: DeleteAttributeModalProps) {
 const qc = useQueryClient();

 const deleteMutation = useMutation({
 mutationFn: () => api.delete(`/attributes/${attribute.id}`),
 onSuccess: () => {
 toast.success(`"${attribute.attribute_name}" deleted`);
 qc.invalidateQueries({ queryKey: ['attributes', categoryId] });
 onClose();
 },
 onError: (err: any) => {
 toast.error(err?.response?.data?.message ?? 'Failed to delete attribute');
 },
 });

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

 <div className="relative z-10 w-full max-w-sm glass-card p-6 space-y-5 animate-in zoom-in-95 duration-150">
 {/* Icon + title */}
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center flex-shrink-0">
 <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
 </div>
 <div>
 <h3 className="text-base font-bold text-white">Delete Attribute Template</h3>
 <p className="text-sm text-[var(--neu-text)] mt-1">
 Delete <span className="text-white font-semibold">"{attribute.attribute_name}"</span>?
 </p>
 </div>
 </div>

 {/* Cascade warning */}
 <div className="p-3 bg-red-400/10 border border-red-400/30 rounded-lg text-xs text-red-300 space-y-1">
 <p className="font-bold text-red-400">⚠ This will remove product data</p>
 <p>
 Deleting this template will also permanently remove its value from
 <strong> all products</strong> assigned to this category. This cannot be undone.
 </p>
 </div>

 {/* Attribute details */}
 <div className="flex flex-wrap gap-2">
 <span className="badge-muted text-xs px-2 py-0.5">Type: {attribute.attribute_type}</span>
 {attribute.is_required && <span className="badge-danger text-xs px-2 py-0.5">Required</span>}
 {attribute.unit && <span className="badge-muted text-xs px-2 py-0.5">Unit: {attribute.unit}</span>}
 </div>

 {/* Actions */}
 <div className="flex justify-end gap-3">
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
 disabled={deleteMutation.isPending}
 className="btn-danger text-sm px-5 py-2"
 >
 {deleteMutation.isPending ? 'Deleting…' : 'Delete Attribute'}
 </button>
 </div>
 </div>
 </div>
 );
}
