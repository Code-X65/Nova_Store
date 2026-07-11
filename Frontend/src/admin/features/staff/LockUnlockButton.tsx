import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useLockAdmin, useUnlockAdmin } from '@/admin/hooks/useAdminAccessConsole';

interface Props {
 adminId: string;
 isLocked: boolean;
 disabled?: boolean;
}

/**
 * Super-Admin-only toggle. Locking instantly terminates all of the target's
 * active sessions across every device (enforced server-side + via SSE events).
 */
export function LockUnlockButton({ adminId, isLocked, disabled }: Props) {
 const lock = useLockAdmin();
 const unlock = useUnlockAdmin();

 const handle = async () => {
 const toastId = toast.loading(isLocked ? 'Unlocking…' : 'Locking…');
 try {
 if (isLocked) await unlock.mutateAsync(adminId);
 else await lock.mutateAsync(adminId);
 toast.success(isLocked ? 'Account unlocked' : 'Account locked — sessions terminated', { id: toastId });
 } catch (err: any) {
 toast.error(err.response?.data?.message || 'Action failed', { id: toastId });
 }
 };

 return (
 <button
 onClick={handle}
 disabled={disabled || lock.isPending || unlock.isPending}
 title={isLocked ? 'Unlock account' : 'Lock account'}
 className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
 isLocked
 ? 'bg-success/10 text-success border-success/15 hover:bg-success/20'
 : 'bg-amber-500/10 text-amber-400 border-amber-500/15 hover:bg-amber-500/20'
 } disabled:opacity-40`}
 >
 {isLocked ? <LockOpenIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
 {isLocked ? 'Unlock' : 'Lock'}
 </button>
 );
}
