import { useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { NotificationBell } from './NotificationBell';
import { NotificationToasts } from '@/admin/components/Toast/NotificationToast';
import { UserMenu } from './UserMenu';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ sidebarCollapsed, onToggleSidebar }: TopbarProps) {
  const { session } = useAdminSession();

  return (
    <header className="h-[80px] flex items-center justify-between px-8 bg-black z-20 relative">
      {/* Left: Search Bar */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-2.5 bg-[#111111] rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-nova-500 transition-colors"
            placeholder="Search anything..."
          />
        </div>
      </div>

      {/* Right: bell + menu */}
      <div className="flex items-center gap-4">
        <NotificationBell />
        <NotificationToasts />
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-[#111111] transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed
            ? <Bars3Icon className="w-6 h-6" />
            : <XMarkIcon className="w-6 h-6" />
          }
        </button>
      </div>
    </header>
  );
}