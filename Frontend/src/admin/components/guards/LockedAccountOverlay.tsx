import { useEffect, useState } from 'react';
import { LockClosedIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

export function LockedAccountOverlay() {
  const [isLocked, setIsLocked] = useState(false);
  const { logout } = useAdminSession();

  useEffect(() => {
    const handleAccountLocked = () => setIsLocked(true);
    
    // Listen to custom window event triggered by the API interceptor
    window.addEventListener('account-locked', handleAccountLocked);
    
    // Also listen to the broadcast channel for cross-tab lockouts
    const channel = new BroadcastChannel('admin-session-channel');
    channel.onmessage = (event) => {
      if (event.data === 'ACCOUNT_LOCKED') {
        setIsLocked(true);
      }
    };

    return () => {
      window.removeEventListener('account-locked', handleAccountLocked);
      channel.close();
    };
  }, []);

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-red-900/20 animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <LockClosedIcon className="w-8 h-8 text-red-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">Account Locked</h2>
        <p className="text-white/60 mb-8">
          Your account has been locked. Kindly contact the Store Owner or Manager for assistance.
        </p>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Force Logout
        </button>
      </div>
    </div>
  );
}
