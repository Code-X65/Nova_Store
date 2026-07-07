import { useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ sidebarCollapsed, onToggleSidebar }: TopbarProps) {
  const { session } = useAdminSession();

  return (
    <header className="h-[80px] flex items-center justify-between px-8 bg-neu-bg z-30 mb-6">
      {/* Left: hamburger + store name */}
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleSidebar}
          className="btn-ghost p-3 rounded-2xl shadow-neu-outer hover:shadow-neu-outer-sm active:shadow-neu-inner text-neu-text hover:text-neu-accent"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed
            ? <Bars3Icon className="w-5 h-5" />
            : <XMarkIcon className="w-5 h-5" />
          }
        </button>

        {session && (
          <div className="hidden sm:flex items-center gap-3 bg-neu-bg px-4 py-2 rounded-xl shadow-neu-inner-sm">
            <span className="text-[11px] text-neu-text font-bold uppercase tracking-widest">Store:</span>
            <span className="text-sm font-bold text-white tracking-wide">{session.storeName}</span>
          </div>
        )}
      </div>

      {/* Right: bell + user menu */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}