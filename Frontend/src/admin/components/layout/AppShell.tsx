import { useState, Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useRealtimeAdminEvents } from '@/admin/hooks/useRealtimeAdminEvents';
import { LockedAccountOverlay } from '@/admin/components/guards/LockedAccountOverlay';

/**
 * Full-page shell: collapsible sidebar + sticky topbar + scrollable main area.
 * Outlet renders the active page route inside.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Real-time access-management sync (lock/unlock/remove/override events).
  useRealtimeAdminEvents();

  return (
    <div className="flex h-screen bg-black overflow-hidden relative">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) {
              setMobileOpen(!mobileOpen);
            } else {
              setCollapsed((c) => !c);
            }
          }}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 canvas-recessed relative z-10">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20 h-full">
              <div className="w-8 h-8 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <LockedAccountOverlay />
    </div>
  );
}