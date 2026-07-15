import { useQuery } from '@tanstack/react-query';
import { fetchDailySummary } from './api/sales';
import { StatCard } from '@/shared/ui/StatCard';
import { ShoppingBagIcon, CurrencyDollarIcon, BanknotesIcon } from '@heroicons/react/24/outline';

export default function DailySummary() {
 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-sales-daily-summary'],
 queryFn: fetchDailySummary
 });

 const today = response?.today || { revenue: 0, orders: 0, aov: 0 };
 const yesterday = response?.yesterday || { revenue: 0, orders: 0, aov: 0 };

 const calculateTrend = (current: number, previous: number) => {
 if (previous === 0) return current > 0 ? '+100%' : '0%';
 const pct = ((current - previous) / previous) * 100;
 return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
 };

 return (
 <div className="space-y-6 w-full">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Daily Summary</h1>
 <p className="text-sm text-muted-foreground mt-1">Snapshot of today's transactional performance.</p>
 </div>
 </div>

 {isLoading ? (
 <div className="p-8 text-muted-foreground">Loading today's metrics...</div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <StatCard 
 title="Today's Revenue" 
 value={`$${Number(today.revenue).toFixed(2)}`}
 icon={CurrencyDollarIcon}
 trend={`${calculateTrend(today.revenue, yesterday.revenue)} vs yesterday`}
 trendUp={today.revenue >= yesterday.revenue}
 />
 <StatCard 
 title="Orders Today" 
 value={today.orders}
 icon={ShoppingBagIcon}
 trend={`${calculateTrend(today.orders, yesterday.orders)} vs yesterday`}
 trendUp={today.orders >= yesterday.orders}
 />
 <StatCard 
 title="Avg Order Value" 
 value={`$${Number(today.aov).toFixed(2)}`}
 icon={BanknotesIcon}
 trend={`${calculateTrend(today.aov, yesterday.aov)} vs yesterday`}
 trendUp={today.aov >= yesterday.aov}
 />
 </div>
 )}

 <div className="glass-card p-6 rounded-xl border mt-8">
 <h2 className="text-lg font-semibold text-white border-b pb-2 mb-4">Yesterday's Context</h2>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <p className="text-sm text-muted-foreground">Revenue</p>
 <p className="text-xl font-medium text-gray-300">${Number(yesterday.revenue).toFixed(2)}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Orders</p>
 <p className="text-xl font-medium text-gray-300">{yesterday.orders}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">AOV</p>
 <p className="text-xl font-medium text-gray-300">${Number(yesterday.aov).toFixed(2)}</p>
 </div>
 </div>
 </div>
 </div>
 );
}