import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircleIcon, ComputerDesktopIcon, ArrowRightOnRectangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAdminSession } from '@/admin/hooks/useAdminSession';
import { useAdminStore } from '@/admin/hooks/useAdminStore';

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { session, logout } = useAdminSession();
  const { store } = useAdminStore();
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
        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#111111] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full bg-[#111111] group-hover:bg-black border border-gray-800 flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors"
            style={{ color: store?.primary_color || '#FF6A1C' }}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="text-left whitespace-nowrap overflow-hidden">
              <p className="text-sm font-medium text-white leading-tight truncate">{session.name || 'James Davis'}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{session.role.replace('_', ' ')}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-2 bg-black border border-gray-800 rounded-xl shadow-nova-xl z-50 py-1 animate-slide-up">
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