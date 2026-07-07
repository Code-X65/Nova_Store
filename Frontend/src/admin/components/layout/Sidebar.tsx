import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  HomeIcon, ShoppingBagIcon, ArchiveBoxIcon, TagIcon, UsersIcon,
  TicketIcon, TruckIcon, StarIcon, UserGroupIcon, ChartBarIcon,
  CogIcon, ShieldCheckIcon, BellIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission, hasAnyPermission, isOwner, isManager } from '@/admin/lib/permissions';

interface NavItem {
  label:  string;
  to:     string;
  icon:   React.ComponentType<{ className?: string }>;
  /** If provided, item only shows when user has this permission */
  perm?:  string;
  /** Alternative: show if user has ANY of these permissions */
  anyOf?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: '/dashboard',          icon: HomeIcon },
  { label: 'Orders',       to: '/orders',             icon: ShoppingBagIcon,  perm: 'order:read' },
  { label: 'Inventory',    to: '/inventory',          icon: ArchiveBoxIcon,   perm: 'inventory:read' },
  { label: 'Catalog',      to: '/catalog/products',   icon: TagIcon,          perm: 'product:read' },
  { label: 'Customers',    to: '/customers',          icon: UsersIcon,        anyOf: ['user:read', 'role:manage'] }, // MANAGER has role:manage
  { label: 'Coupons',      to: '/coupons',            icon: TicketIcon,       perm: 'coupon:read' },
  { label: 'Shipping',     to: '/shipping',           icon: TruckIcon,        perm: 'shipping:read' },
  { label: 'Reviews',      to: '/reviews',            icon: StarIcon,         perm: 'review:read' },
  { label: 'Staff',        to: '/staff',              icon: UserGroupIcon,    anyOf: ['admin:invite', 'role:manage'] }, // MANAGER/OWNER only
  { label: 'Sales',        to: '/sales',              icon: ChartBarIcon,     perm: 'sales:read' },
  { label: 'Settings',     to: '/settings',           icon: CogIcon,          perm: 'settings:read' },
  { label: 'Audit',        to: '/audit',              icon: ShieldCheckIcon,  perm: 'audit:read' },
  { label: 'Notifications',to: '/notifications/admin',icon: BellIcon,         anyOf: ['settings:write', 'notification:write'] },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const perms = useMyPermissions();

  const visible = NAV_ITEMS.filter((item) => {
    if (!item.perm && !item.anyOf) return true;
    if (item.anyOf) return hasAnyPermission(perms, ...item.anyOf);
    return hasPermission(perms, item.perm!);
  });

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-neu-bg transition-all duration-300 relative z-10 shadow-neu-outer',
        collapsed ? 'w-[88px]' : 'w-72'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-4 px-6 py-8 mb-4">
        <div className="w-12 h-12 rounded-2xl shadow-neu-outer-sm flex items-center justify-center flex-shrink-0 text-neu-accent font-black text-xl">
          N
        </div>
        {!collapsed && (
          <div className="flex flex-col">
             <span className="font-bold text-white text-xl tracking-wider leading-tight">Nova</span>
             <span className="font-bold text-neu-text text-xs tracking-widest uppercase leading-tight mt-1">Admin</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-4 space-y-3 overflow-y-auto">
        {!collapsed && (
          <p className="px-2 mb-4 text-[11px] font-bold text-neu-text uppercase tracking-widest">Navigation</p>
        )}
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx('sidebar-item', isActive && 'sidebar-item-active')
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-[20px] h-[20px] flex-shrink-0" />
            {!collapsed && <span className="tracking-wide">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Sessions link */}
      <div className="py-6 px-4 mt-auto">
        <NavLink
          to="/profile/sessions"
          className={({ isActive }) =>
            clsx('sidebar-item', isActive && 'sidebar-item-active')
          }
          title={collapsed ? 'Sessions' : undefined}
        >
          <DocumentTextIcon className="w-[20px] h-[20px] flex-shrink-0" />
          {!collapsed && <span className="tracking-wide">Sessions</span>}
        </NavLink>
      </div>
    </aside>
  );
}