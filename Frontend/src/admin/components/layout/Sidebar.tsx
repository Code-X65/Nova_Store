import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  HomeIcon, ShoppingBagIcon, ArchiveBoxIcon, TagIcon, UsersIcon,
  TicketIcon, TruckIcon, StarIcon, UserGroupIcon, ChartBarIcon,
  CogIcon, ShieldCheckIcon, BellIcon, DocumentTextIcon, Squares2X2Icon,
  SparklesIcon, CurrencyDollarIcon, DocumentIcon, ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon, BellAlertIcon, UserPlusIcon, KeyIcon, GlobeAltIcon,
  MapIcon, ArrowUturnLeftIcon, BanknotesIcon, PhotoIcon
} from '@heroicons/react/24/outline';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { useAdminStore } from '@/admin/hooks/useAdminStore';
import { hasPermission, hasAnyPermission, isOwner, isManager } from '@/admin/lib/permissions';
import { UserMenu } from './UserMenu';

interface NavItem {
  label:  string;
  to:     string;
  icon:   React.ComponentType<{ className?: string }>;
  perm?:  string;
  anyOf?: string[];
  roles?: string[];
  group: 'MAIN MENU' | 'MANAGEMENT';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: '/dashboard',          icon: HomeIcon, group: 'MAIN MENU' },
  { label: 'Products',     to: '/catalog/products',   icon: TagIcon,          perm: 'product:read', group: 'MAIN MENU' },
  { label: 'Categories',   to: '/catalog/categories', icon: Squares2X2Icon,   anyOf: ['category:read', 'category:write'], group: 'MAIN MENU' },
  { label: 'Variants',     to: '/catalog/variants',   icon: Squares2X2Icon,   anyOf: ['product:read', 'product:write'], group: 'MAIN MENU' },
  { label: 'Brands',       to: '/catalog/brands',     icon: SparklesIcon,     anyOf: ['brand:read', 'brand:write'], group: 'MAIN MENU' },
  { label: 'Bulk Import',  to: '/catalog/import',     icon: DocumentIcon,     anyOf: ['product:create', 'product:write', 'inventory:write'], group: 'MAIN MENU' },
  { label: 'Orders',       to: '/orders',             icon: ShoppingBagIcon,  perm: 'order:read', group: 'MAIN MENU' },
  { label: 'Customers',    to: '/customers',          icon: UsersIcon,        anyOf: ['user:read', 'role:manage'], group: 'MAIN MENU' },
  { label: 'Sales',        to: '/sales',              icon: ChartBarIcon,     perm: 'sales:read', group: 'MAIN MENU' },
  { label: 'Marketing',    to: '/coupons',            icon: TicketIcon,       perm: 'coupon:read', group: 'MAIN MENU' },
  
  { label: 'Inventory',    to: '/inventory',          icon: ArchiveBoxIcon,   perm: 'inventory:read', group: 'MANAGEMENT' },
  { label: 'Low Stock',    to: '/inventory/low-stock', icon: ExclamationTriangleIcon, perm: 'inventory:read', group: 'MANAGEMENT' },
  { label: 'Transactions', to: '/inventory/transactions', icon: DocumentTextIcon, perm: 'inventory:read', group: 'MANAGEMENT' },
  { label: 'Catalog History', to: '/inventory/transactions/catalog', icon: DocumentTextIcon, anyOf: ['product:read', 'category:read', 'brand:read', 'inventory:read'], group: 'MANAGEMENT' },
  { label: 'Thresholds',   to: '/inventory/thresholds', icon: AdjustmentsHorizontalIcon, anyOf: ['inventory:alert', 'inventory:write'], group: 'MANAGEMENT' },
  { label: 'Warehouses',   to: '/inventory/warehouses', icon: ArchiveBoxIcon, perm: 'inventory:read', group: 'MANAGEMENT' },
  { label: 'Alert Rules',  to: '/inventory/alert-rules', icon: BellAlertIcon, anyOf: ['inventory:alert', 'inventory:write'], group: 'MANAGEMENT' },
  { label: 'Shipping',     to: '/shipping',           icon: TruckIcon,        perm: 'shipping:read', group: 'MANAGEMENT' },
  { label: 'Reviews',      to: '/reviews',            icon: StarIcon,         perm: 'review:read', group: 'MANAGEMENT' },
  { label: 'Team & Roles', to: '/staff',              icon: UserGroupIcon,    perm: 'staff:read', group: 'MANAGEMENT' },
  { label: 'Roles',        to: '/staff/roles',        icon: KeyIcon,          anyOf: ['staff:write', 'role:manage'], group: 'MANAGEMENT' },
  { label: 'Riders',       to: '/riders',             icon: UserPlusIcon,     anyOf: ['rider:read', 'rider:write', '*'], group: 'MANAGEMENT' },
  { label: 'Rider Tracking',to: '/logistics/rider-tracking', icon: MapIcon,   perm: 'logistics:read', group: 'MANAGEMENT' },
  { label: 'Fulfillment',  to: '/logistics/fulfillment', icon: TruckIcon,     perm: 'fulfillment:read', group: 'MANAGEMENT' },
  { label: 'Returns',      to: '/logistics/returns',  icon: ArrowUturnLeftIcon, perm: 'returns:read', group: 'MANAGEMENT' },
  { label: 'Invoices',     to: '/billing/invoices',   icon: DocumentTextIcon, perm: 'billing:read', group: 'MANAGEMENT' },
  { label: 'Refunds',      to: '/finance/refunds',    icon: BanknotesIcon,    perm: 'finance:read', group: 'MANAGEMENT' },
  { label: 'Disputes',     to: '/finance/disputes',    icon: ExclamationTriangleIcon, perm: 'disputes:read', group: 'MANAGEMENT' },
  { label: 'Settings',     to: '/settings/general',   icon: CogIcon,          perm: 'settings:read', group: 'MANAGEMENT' },
  { label: 'Security',     to: '/settings/security',   icon: KeyIcon,          perm: 'settings:read', group: 'MANAGEMENT' },
  { label: 'IP Allowlist', to: '/staff/ip-allowlist',  icon: GlobeAltIcon,  perm: 'rbac:read', group: 'MANAGEMENT' },
  { label: 'Audit',        to: '/audit',              icon: ShieldCheckIcon,  perm: 'audit:read', group: 'MANAGEMENT' },
  { label: 'Notifications',to: '/notifications',    icon: BellIcon,         perm: 'notifications:read', group: 'MANAGEMENT' },
  { label: 'Send Broadcast', to: '/notifications/admin', icon: BellAlertIcon, perm: 'notifications:write', group: 'MANAGEMENT' },
  { label: 'Notification Templates', to: '/notifications/admin/templates', icon: DocumentTextIcon, perm: 'notifications:write', group: 'MANAGEMENT' },
  { label: 'Sessions',     to: '/profile/sessions',   icon: DocumentTextIcon, group: 'MANAGEMENT' },
  { label: 'Segments',     to: '/crm/segments',       icon: UserGroupIcon,    perm: 'segment:read', group: 'MANAGEMENT' },
  { label: 'Support Tickets', to: '/crm/tickets',     icon: TicketIcon,       perm: 'ticket:read', group: 'MANAGEMENT' },
  { label: 'Customer Events', to: '/crm/events',      icon: DocumentTextIcon, perm: 'customer_event:read', group: 'MANAGEMENT' },
  { label: 'Campaigns',    to: '/campaigns',          icon: SparklesIcon,     perm: 'marketing:read', group: 'MANAGEMENT' },
  { label: 'Abandoned Carts', to: '/marketing/abandoned-carts', icon: ExclamationTriangleIcon, perm: 'marketing:read', group: 'MANAGEMENT' },
  { label: 'Product Q&A',  to: '/qa',                  icon: DocumentTextIcon, perm: 'qa:read', group: 'MANAGEMENT' },
  { label: 'Banners',      to: '/cms/banners',         icon: PhotoIcon,        perm: 'cms:read', group: 'MANAGEMENT' },
  { label: 'Pages',        to: '/cms/pages',           icon: DocumentIcon,     perm: 'cms:read', group: 'MANAGEMENT' },
  { label: 'Blog Posts',   to: '/cms/blog',            icon: DocumentTextIcon, perm: 'cms:read', group: 'MANAGEMENT' },
  { label: 'POS Terminal', to: '/pos',                 icon: ShoppingBagIcon,  perm: 'pos:create', group: 'MANAGEMENT' },
  { label: 'POS Sales History', to: '/pos/history',    icon: DocumentTextIcon, perm: 'pos:read', group: 'MANAGEMENT' },
  { label: 'Forecasting',  to: '/analytics/forecasting', icon: ChartBarIcon,  perm: 'analytics:read', group: 'MANAGEMENT' },
  { label: 'Customer Heatmaps', to: '/analytics/heatmaps', icon: MapIcon,     perm: 'analytics:read', group: 'MANAGEMENT' },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const perms = useMyPermissions();
  const { store } = useAdminStore();

  const visible = NAV_ITEMS.filter((item) => {
    if (!item.perm && !item.anyOf && !item.roles) return true;

    let slugAllowed = false;
    if (item.perm) slugAllowed = hasPermission(perms, item.perm);
    else if (item.anyOf) slugAllowed = hasAnyPermission(perms, ...item.anyOf);

    let roleAllowed = false;
    if (item.roles) {
      roleAllowed = item.roles.some(r => perms.role === r || (r === 'STORE_OWNER' && isOwner(perms)) || (r === 'MANAGER' && isManager(perms)));
    }

    return slugAllowed || roleAllowed;
  });

  const mainMenuItems = visible.filter(item => item.group === 'MAIN MENU');
  const managementItems = visible.filter(item => item.group === 'MANAGEMENT');

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-black transition-all duration-300 relative z-10',
        collapsed ? 'w-[88px]' : 'w-[280px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 mb-2">
        <div 
          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 font-black text-xl overflow-hidden bg-[#111111]"
          style={{ color: store?.primary_color || '#FF6A1C' }}
        >
          {store?.favicon_url || store?.logo_url ? (
            <img src={store.favicon_url || store.logo_url} alt="Store Logo" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          )}
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-lg tracking-wide truncate">
            {store?.name || 'NovaStore'}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {/* MAIN MENU */}
        {mainMenuItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="px-2 mb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Main Menu</p>
            )}
            <div className="space-y-1">
              {mainMenuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative',
                      isActive 
                        ? 'bg-[#111111] text-nova-500 font-medium' 
                        : 'text-gray-400 hover:text-white hover:bg-[#111111]/50'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !collapsed && (
                        <div 
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-nova-500 rounded-r-full"
                          style={{ backgroundColor: store?.primary_color || undefined }}
                        />
                      )}
                      <item.icon 
                        className={clsx('w-5 h-5 flex-shrink-0', isActive ? 'text-nova-500' : 'text-gray-400 group-hover:text-white')}
                        style={{ color: isActive ? (store?.primary_color || undefined) : undefined }}
                      />
                      {!collapsed && (
                        <span 
                          className="tracking-wide text-sm"
                          style={{ color: isActive ? (store?.primary_color || undefined) : undefined }}
                        >
                          {item.label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* MANAGEMENT */}
        {managementItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="px-2 mb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Management</p>
            )}
            <div className="space-y-1">
              {managementItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative',
                      isActive 
                        ? 'bg-[#111111] text-nova-500 font-medium' 
                        : 'text-gray-400 hover:text-white hover:bg-[#111111]/50'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !collapsed && (
                        <div 
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-nova-500 rounded-r-full"
                          style={{ backgroundColor: store?.primary_color || undefined }}
                        />
                      )}
                      <item.icon 
                        className={clsx('w-5 h-5 flex-shrink-0', isActive ? 'text-nova-500' : 'text-gray-400 group-hover:text-white')}
                        style={{ color: isActive ? (store?.primary_color || undefined) : undefined }}
                      />
                      {!collapsed && (
                        <span 
                          className="tracking-wide text-sm"
                          style={{ color: isActive ? (store?.primary_color || undefined) : undefined }}
                        >
                          {item.label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: User Profile */}
      <div className="p-4 mt-auto">
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}