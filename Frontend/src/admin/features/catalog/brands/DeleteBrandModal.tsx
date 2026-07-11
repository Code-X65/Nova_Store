import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { Brand } from './BrandsTable';

interface DeleteBrandModalProps {
 brand: Brand;
 onClose: () => void;
}

export function DeleteBrandModal({ brand, onClose }: DeleteBrandModalProps) {
 const qc = useQueryClient();

 const deleteMutation = useMutation({
 mutationFn: () => api.delete(`/brands/${brand.id}`),
 onMutate: async () => {
 await qc.cancelQueries({ queryKey: ['brands'] });
 const previousStates = qc.getQueriesData({ queryKey: ['brands'] });
 
 qc.setQueriesData({ queryKey: ['brands'] }, (oldData: any) => {
 if (!oldData) return [];
 return oldData.filter((b: any) => b.id !== brand.id);
 });
 
 onClose(); // instantly close modal
 return { previousStates };
 },
 onSuccess: () => {
 toast.success(`"${brand.name}" archived`);
 },
 onError: (err: any, variables, context) => {
 if (context?.previousStates) {
 context.previousStates.forEach(([queryKey, data]) => {
 qc.setQueryData(queryKey, data);
 });
 }
 toast.error(err?.response?.data?.message ?? 'Failed to archive brand');
 },
 onSettled: () => {
 qc.invalidateQueries({ queryKey: ['brands'] });
 },
 });

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

 <div className="relative z-10 w-full max-w-sm glass-card p-6 space-y-5 animate-in zoom-in-95 duration-150">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-orange-400/10 border border-orange-400/20 flex items-center justify-center flex-shrink-0">
 <ExclamationTriangleIcon className="w-5 h-5 text-orange-400" />
 </div>
 <div>
 <h3 className="text-base font-bold text-white">Archive Brand</h3>
 <p className="text-sm text-[var(--neu-text)] mt-1">
 Are you sure you want to archive <span className="text-white font-semibold">"{brand.name}"</span>?
 </p>
 </div>
 </div>

 <div className="p-3 bg-orange-400/10 border border-orange-400/30 rounded-lg text-xs text-orange-300 space-y-1">
 <p className="font-bold text-orange-400">Products will remain intact</p>
 <p>
 Archiving hides the brand from public listings and menus, but does not delete products associated with it. 
 You can restore it later if needed.
 </p>
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
 className="btn-primary bg-orange-500 hover:bg-orange-600 border-none text-white text-sm px-5 py-2"
 >
 {deleteMutation.isPending ? 'Archiving…' : 'Archive Brand'}
 </button>
 </div>
 </div>
 </div>
 );
}
