import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircleIcon, ComputerDesktopIcon, ArrowRightOnRectangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

export function UserMenu() {
  const { session, logout } = useAdminSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  if (!session) return null;

  const initials = session.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        id="user-menu-btn"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-4 btn-ghost px-3 py-2 rounded-2xl shadow-neu-outer hover:shadow-neu-outer-sm active:shadow-neu-inner"
      >
        <div className="w-10 h-10 rounded-xl shadow-neu-inner flex items-center justify-center text-sm font-black text-neu-accent">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-bold text-white leading-none">{session.name}</p>
          <p className="text-[10px] text-neu-text uppercase font-bold tracking-widest leading-none mt-1.5">{session.role.replace('_', ' ')}</p>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-neu-text transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-52 glass-card shadow-nova-xl z-50 py-1 animate-slide-down">
          <div className="px-3 py-2 border-b border-white/5 mb-1">
            <p className="text-xs text-muted-foreground truncate">{session.email}</p>
            <p className="text-xs text-nova-400 mt-0.5">{session.storeName}</p>
          </div>

          <Link
            to="/profile/sessions"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-white hover:bg-surface-2/50 transition-colors"
          >
            <ComputerDesktopIcon className="w-4 h-4" />
            Active sessions
          </Link>

          <Link
            to="/staff/my-permissions"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-white hover:bg-surface-2/50 transition-colors"
          >
            <UserCircleIcon className="w-4 h-4" />
            My permissions
          </Link>

          <div className="border-t border-white/5 mt-1 pt-1">
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}