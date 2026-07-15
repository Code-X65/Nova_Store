import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRevenueAnalytics, fetchRevenueSummary, exportRevenueCsv } from './api/sales';
import { StatCard } from '@/shared/ui/StatCard';
import { ChartContainer, CustomTooltip } from '@/shared/ui/ChartContainer';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CurrencyDollarIcon, PresentationChartLineIcon, ChartBarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { subDays, startOfYear, format } from 'date-fns';

export default function SalesReports() {
 const [dateRangeOption, setDateRangeOption] = useState('30d');
 
 const { from, to, groupBy } = useMemo(() => {
 const today = new Date();
 let fromDate = new Date();
 let group = 'day';
 
 if (dateRangeOption === '7d') {
 fromDate = subDays(today, 7);
 } else if (dateRangeOption === '30d') {
 fromDate = subDays(today, 30);
 } else if (dateRangeOption === '90d') {
 fromDate = subDays(today, 90);
 group = 'week';
 } else if (dateRangeOption === 'ytd') {
 fromDate = startOfYear(today);
 group = 'month';
 }
 
 return {
 from: fromDate.toISOString(),
 to: today.toISOString(),
 groupBy: group
 };
 }, [dateRangeOption]);

 const { data: revenueResponse, isLoading: revLoading } = useQuery({
 queryKey: ['admin-analytics-revenue', from, to, groupBy],
 queryFn: async () => fetchRevenueAnalytics({ from, to, groupBy })
 });

 const { data: summaryResponse, isLoading: sumLoading } = useQuery({
 queryKey: ['admin-analytics-revenue-summary', from, to],
 queryFn: async () => fetchRevenueSummary({ from, to })
 });

 const handleExportCSV = async () => {
 try {
 const blob = await exportRevenueCsv({ from, to });
 const url = window.URL.createObjectURL(new Blob([blob]));
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
 document.body.appendChild(link);
 link.click();
 link.remove();
 } catch (error) {
 console.error('Failed to export CSV', error);
 }
 };

 const metrics = summaryResponse || {
 totalRevenue: 0,
 totalOrders: 0,
 averageOrderValue: 0
 };

 const chartData = useMemo(() => {
 return (revenueResponse?.data || []).map((d: any) => ({
 date: new Date(d.period || d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
 revenue: Number(d.revenue || 0)
 }));
 }, [revenueResponse]);

 const isLoading = revLoading || sumLoading;

 return (
 <div className="space-y-6 w-full">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-white">Sales Reports</h1>
 <p className="text-sm text-muted-foreground mt-1">High-level overview of revenue and order volume.</p>
 </div>
 <div className="flex items-center gap-3">
 <select
 value={dateRangeOption}
 onChange={(e) => setDateRangeOption(e.target.value)}
 className="bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 >
 <option value="7d">Last 7 Days</option>
 <option value="30d">Last 30 Days</option>
 <option value="90d">Last 90 Days</option>
 <option value="ytd">Year to Date</option>
 </select>
 <button
 onClick={handleExportCSV}
 className="btn-secondary py-2 px-4 flex items-center gap-2"
 >
 <ArrowDownTrayIcon className="w-4 h-4" />
 <span className="hidden sm:inline">Export CSV</span>
 </button>
 </div>
 </div>

 {isLoading ? (
 <div className="p-8 text-muted-foreground">Loading report data...</div>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <StatCard 
  title="Total Revenue" 
  value={formatNaira(metrics.totalRevenue)}
  icon={<CurrencyDollarIcon className="w-6 h-6" />}
  trendUp={true}
  />
 <StatCard 
 title="Order Volume" 
 value={metrics.totalOrders}
 icon={<ChartBarIcon className="w-6 h-6" />}
 />
  <StatCard 
  title="Average Order Value" 
  value={formatNaira(metrics.averageOrderValue)}
  icon={<PresentationChartLineIcon className="w-6 h-6" />}
  />
 </div>

 <div className="grid grid-cols-1 gap-6">
 <ChartContainer title={`Revenue Trends (${groupBy})`} height={400}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
 <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${value}`} />
  <Tooltip content={<CustomTooltip formatter={(value: number) => `₦${value.toFixed(2)}`} />} />
 <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </ChartContainer>
 </div>
 </>
 )}
 </div>
 );
}