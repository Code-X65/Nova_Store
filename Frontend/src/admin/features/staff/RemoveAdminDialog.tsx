import { useState } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useRemoveAdmin } from '@/admin/hooks/useAdminAccessConsole';

interface Props {
 isOpen: boolean;
 onClose: () => void;
 targetId: string | null;
 targetName: string;
}

/**
 * Permanent-removal confirmation. This purges the administrator profile
 * (after an immutable forensic snapshot) — distinct from soft"revoke".
 */
export function RemoveAdminDialog({ isOpen, onClose, targetId, targetName }: Props) {
 const [reason, setReason] = useState('');
 const removeAdmin = useRemoveAdmin();

 if (!isOpen) return null;

 const handleRemove = async () => {
 if (!targetId) return;
 const toastId = toast.loading('Removing administrator…');
 try {
 await removeAdmin.mutateAsync({ id: targetId, reason: reason || undefined });
 toast.success('Administrator permanently removed', { id: toastId });
 onClose();
 } catch (err: any) {
 toast.error(err.response?.data?.message || 'Failed to remove administrator', { id: toastId });
 }
 };

 return (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
 <div className="relative w-full max-w-md bg-zinc-950/90 border border-danger/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
 <div className="px-6 py-5 flex items-center justify-between border-b">
 <h2 className="text-lg font-bold text-white flex items-center gap-2 text-danger">
 <ExclamationTriangleIcon className="w-5 h-5" /> Permanently Remove
 </h2>
 <button onClick={onClose} className="p-2 text-white/40 hover:text-white rounded-lg">
 <XMarkIcon className="w-5 h-5" />
 </button>
 </div>

 <div className="p-6 space-y-4">
 <p className="text-sm text-white/70">
 This will <span className="font-bold text-danger">permanently purge</span>{' '}
 <span className="font-semibold text-white">{targetName}</span>'s administrator profile,
 revoke all sessions, and remove their roles and overrides. An immutable audit record is kept.
 This cannot be undone.
 </p>

 <div>
 <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Reason (optional)</label>
 <textarea
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={2}
 className="mt-1.5 w-full bg-white/[0.03] border rounded-lg px-3 py-2 text-white text-sm focus:border-danger focus:ring-1 focus:ring-danger"
 placeholder="Why is this account being removed?"
 />
 </div>

 <div className="flex justify-end gap-3 pt-2">
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/5 rounded-xl border"
 >
 Cancel
 </button>
 <button
 onClick={handleRemove}
 disabled={removeAdmin.isPending}
 className="px-5 py-2 text-sm font-semibold text-white bg-danger hover:bg-danger/80 rounded-xl disabled:opacity-40 transition-all"
 >
 {removeAdmin.isPending ? 'Removing…' : 'Remove Permanently'}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
