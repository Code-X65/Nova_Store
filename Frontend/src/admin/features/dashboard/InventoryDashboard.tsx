import { useQuery } from '@tanstack/react-query';
import { fetchInventoryStats } from './api/dashboard';
import { StatCard } from '@/shared/ui/StatCard';
import { ExclamationTriangleIcon, ArchiveBoxXMarkIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export default function InventoryDashboard() {
 const { data: statsData, isLoading } = useQuery({
 queryKey: ['analytics', 'inventory-stats'],
 queryFn: async () => fetchInventoryStats({ limit: 20 })
 });

 const lowStock = statsData?.lowStockProducts || [];
 const outOfStock = statsData?.outOfStockProducts || [];

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Inventory Dashboard</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Monitor your stock health and active alerts.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <StatCard
 title="Low Stock Items"
 value={lowStock.length}
 icon={<ExclamationTriangleIcon className="w-6 h-6" />}
 loading={isLoading}
 />
 <StatCard
 title="Out of Stock Items"
 value={outOfStock.length}
 icon={<ArchiveBoxXMarkIcon className="w-6 h-6" />}
 loading={isLoading}
 />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="glass-card p-6 rounded-xl border space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-white">Out of Stock Alerts</h3>
 <Link to="/inventory/low-stock" className="text-sm text-nova-500 hover:text-nova-400">View All</Link>
 </div>
 
 <div className="space-y-3">
 {isLoading ? (
 <p className="text-muted-foreground text-sm">Loading alerts...</p>
 ) : outOfStock.length === 0 ? (
 <p className="text-muted-foreground text-sm">No items are out of stock.</p>
 ) : (
 outOfStock.slice(0, 5).map((item: any) => (
 <div key={item.id} className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-between">
 <span className="text-sm font-medium text-danger">{item.name}</span>
 <Link to={`/inventory/adjust?product=${item.id}`} className="text-xs font-bold text-danger hover:underline">
 RESTOCK
 </Link>
 </div>
 ))
 )}
 </div>
 </div>

 <div className="glass-card p-6 rounded-xl border space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-white">Low Stock Warnings</h3>
 <Link to="/inventory/low-stock" className="text-sm text-nova-500 hover:text-nova-400">View All</Link>
 </div>
 
 <div className="space-y-3">
 {isLoading ? (
 <p className="text-muted-foreground text-sm">Loading warnings...</p>
 ) : lowStock.length === 0 ? (
 <p className="text-muted-foreground text-sm">No items are low on stock.</p>
 ) : (
 lowStock.slice(0, 5).map((item: any) => (
 <div key={item.id} className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center justify-between">
 <span className="text-sm font-medium text-warning">{item.name}</span>
 <span className="text-xs font-bold text-warning">{item.stock_quantity} left</span>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
