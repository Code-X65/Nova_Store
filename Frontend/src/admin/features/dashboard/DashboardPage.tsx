import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission } from '@/admin/lib/permissions';
import AdminDashboard from './AdminDashboard';
import OrderDashboard from './OrderDashboard';
import InventoryDashboard from './InventoryDashboard';

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6 tracking-tight">Dashboard</h1>
      
      {/* Top Full-width Block */}
      <div className="w-full h-40 bg-neu-bg rounded-3xl shadow-neu-inner animate-pulse relative overflow-hidden">
      </div>
      
      {/* Bottom Split Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 bg-neu-bg rounded-3xl shadow-neu-inner animate-pulse relative overflow-hidden">
        </div>
        <div className="h-96 bg-neu-bg rounded-3xl shadow-neu-outer animate-pulse flex items-center justify-center p-8 relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl shadow-neu-inner flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-neu-accent/50 blur-sm"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const perms = useMyPermissions();

  if (perms.isLoading) {
    return <DashboardSkeleton />;
  }

  // Route based on permissions
  // STORE_OWNER and MANAGER get full analytics
  if (hasPermission(perms, 'analytics:read')) {
    return <AdminDashboard />;
  }

  // ORDER_STAFF gets the fulfillment dashboard
  if (hasPermission(perms, 'order:read')) {
    return <OrderDashboard />;
  }

  // INVENTORY_STAFF gets the stock dashboard
  if (hasPermission(perms, 'inventory:read')) {
    return <InventoryDashboard />;
  }

  return (
    <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
      No dashboard views are available for your current permissions.
    </div>
  );
}
