import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { StatCard } from '@/admin/features/dashboard/StatCard';
import { ChartContainer } from '@/admin/features/dashboard/ChartContainer';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CurrencyDollarIcon, PresentationChartLineIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function SalesReports() {
  const [period, setPeriod] = useState('30d'); // 7d, 30d, 90d

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-sales-reports', period],
    queryFn: async () => {
      const { data } = await api.get('/admin/sales/reports', {
        params: { period }
      });
      return data.data; // { metrics: {}, daily_revenue: [] }
    }
  });

  const metrics = response?.metrics || {
    total_revenue: 0,
    order_count: 0,
    average_order_value: 0
  };

  const chartData = useMemo(() => {
    return (response?.daily_revenue || []).map((d: any) => ({
      date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      revenue: Number(d.revenue || 0)
    }));
  }, [response]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">High-level overview of revenue and order volume.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {isLoading ? (
        <div className="p-8 text-muted-foreground">Loading report data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Total Revenue" 
              value={`$${Number(metrics.total_revenue).toFixed(2)}`}
              icon={CurrencyDollarIcon}
              trend="+12% from previous"
              trendUp={true}
            />
            <StatCard 
              title="Order Volume" 
              value={metrics.order_count}
              icon={ChartBarIcon}
            />
            <StatCard 
              title="Average Order Value" 
              value={`$${Number(metrics.average_order_value).toFixed(2)}`}
              icon={PresentationChartLineIcon}
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <ChartContainer title="Revenue Trends">
              <div className="h-80 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#11111f', borderColor: '#ffffff10', borderRadius: '8px' }}
                      itemStyle={{ color: '#818ea3' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartContainer>
          </div>
        </>
      )}
    </div>
  );
}