import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { StatCard } from '@/shared/ui/StatCard';
import { ChartContainer, CustomTooltip } from '@/shared/ui/ChartContainer';
import { CurrencyDollarIcon, ShoppingCartIcon, UsersIcon } from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminDashboard() {
  const { data: response, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/dashboard');
      return data.data; // { metrics, revenueOverTime, topProducts }
    }
  });

  const metrics = response?.metrics || { totalSales: 0, totalOrders: 0, totalUsers: 0 };
  const revenueData = response?.revenueOverTime || [];
  const topProducts = response?.topProducts || [];

  const pieData = [
    { name: 'Pending', value: metrics.pending || 0 },
    { name: 'Shipped', value: metrics.shipped || 0 },
    { name: 'Delivered', value: metrics.delivered || 0 },
  ].filter(d => d.value > 0);

  const COLORS = ['#eab308', '#4f46e5', '#22c55e'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Owner & Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          High-level analytics and store performance over the last 30 days.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Revenue"
          value={`$${metrics.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<CurrencyDollarIcon className="w-6 h-6" />}
          loading={isLoading}
        />
        <StatCard
          title="Total Orders"
          value={metrics.totalOrders?.toLocaleString()}
          icon={<ShoppingCartIcon className="w-6 h-6" />}
          loading={isLoading}
        />
        <StatCard
          title="New Users"
          value={metrics.totalUsers?.toLocaleString() || 0}
          icon={<UsersIcon className="w-6 h-6" />}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2">
          <ChartContainer title="Revenue Trend (Last 30 Days)" height={350}>
            <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2b36" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#6b7280" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip content={<CustomTooltip formatter={(v: any) => `$${v}`} />} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#4f46e5" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
            </AreaChart>
          </ChartContainer>
        </div>

        {/* Order Status Breakdown */}
        <div>
          <ChartContainer title="Order Status Breakdown" height={350}>
            {pieData.length > 0 ? (
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No order data available
              </div>
            )}
          </ChartContainer>
        </div>
      </div>

      {/* Top Sellers Table */}
      <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
        <h3 className="text-lg font-semibold text-white">Top Selling Products</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-[#1a1b23] border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4 text-right">Units Sold</th>
                <th className="px-6 py-4 text-right">Revenue generated</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No sales data available.
                  </td>
                </tr>
              ) : (
                topProducts.map((product: any) => (
                  <tr key={product.id} className="border-b border-gray-800 hover:bg-[#1a1b23]/50">
                    <td className="px-6 py-4 font-medium text-white">{product.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{product.sku}</td>
                    <td className="px-6 py-4 text-right font-medium">{product.total_sold}</td>
                    <td className="px-6 py-4 text-right text-success font-semibold">
                      ${Number(product.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
