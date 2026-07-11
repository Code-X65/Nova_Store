import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { ChartContainer, CustomTooltip } from '@/shared/ui/ChartContainer';
import { DocumentTextIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { ArrowUpIcon, ArrowDownIcon, CalendarIcon } from '@heroicons/react/20/solid';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { subDays, startOfYear, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAdminSession } from '@/admin/hooks/useAdminSession';
import clsx from 'clsx';

export default function AdminDashboard() {
 const { session } = useAdminSession();
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

 const { data: dashResponse, isLoading: dashLoading } = useQuery({
 queryKey: ['analytics', 'dashboard', from, to, groupBy],
 queryFn: async () => {
 const { data } = await api.get('/admin/analytics/dashboard', {
 params: { from, to, period: groupBy }
 });
 return data.data;
 }
 });

 const { data: usersResponse } = useQuery({
 queryKey: ['analytics', 'users', from, to, groupBy],
 queryFn: async () => {
 const { data } = await api.get('/admin/analytics/users', {
 params: { from, to, groupBy }
 });
 return data.data;
 }
 });

 const { data: bestSellersResponse } = useQuery({
 queryKey: ['analytics', 'best-sellers', from, to],
 queryFn: async () => {
 const { data } = await api.get('/admin/analytics/best-sellers', {
 params: { from, to, limit: 5 }
 });
 return data.data;
 }
 });

 const { data: recentOrdersResponse } = useQuery({
 queryKey: ['orders', 'recent'],
 queryFn: async () => {
 const { data } = await api.get('/orders/admin/list', { params: { limit: 4 } });
 return data;
 }
 });

 const metrics = dashResponse?.metrics || { totalSales: 0, totalOrders: 0, totalUsers: 0 };
 const revenueData = dashResponse?.charts?.revenueOverTime || dashResponse?.revenueOverTime || [];
 const topProducts = bestSellersResponse?.products || dashResponse?.charts?.topProducts || dashResponse?.topProducts || [];
 const recentOrders = recentOrdersResponse?.orders || [];
 const activeUsers = usersResponse?.metrics?.activeUsers || Math.floor((metrics.totalUsers || 0) * 0.79);
 const categoryData = dashResponse?.charts?.salesByCategory || [];

 const isLoading = dashLoading;

 return (
 <div className="space-y-6 max-w-[1600px]">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Welcome back, {session?.first_name || 'Admin'}! Here's what's happening with your store today.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center bg-black rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-nova-500 transition-colors">
 <CalendarIcon className="w-4 h-4 text-gray-400 mr-2" />
 <select
 value={dateRangeOption}
 onChange={(e) => setDateRangeOption(e.target.value)}
 className="bg-transparent text-sm text-white font-medium focus:outline-none appearance-none pr-6 cursor-pointer"
 style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0 center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
 >
 <option value="7d">Last 7 Days</option>
 <option value="30d">Last 30 Days</option>
 <option value="90d">Last 90 Days</option>
 <option value="ytd">Year to Date</option>
 </select>
 </div>
 </div>
 </div>

 {/* Row 1: Top Cards */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Sales Summary */}
 <div className="bg-black rounded-xl p-5 flex flex-col justify-between">
 <div className="flex justify-between items-start mb-6">
 <h2 className="text-sm font-semibold text-white flex items-center gap-2">
 <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center">
 <span className="w-2 h-2 bg-nova-500 rounded-sm"></span>
 </span>
 Sales Summary
 </h2>
 <Link to="/analytics" className="text-xs font-semibold text-nova-500 hover:text-nova-400 transition-colors">
 View Report
 </Link>
 </div>
 <div>
 <p className="text-xs text-gray-400 mb-1">Total Sales</p>
 <div className="flex items-end gap-3 mb-1">
 <span className="text-3xl font-bold text-white tracking-tight">
 ${metrics.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </span>
 <span className="flex items-center text-xs font-semibold text-success mb-1">
 <ArrowUpIcon className="w-3 h-3 mr-0.5" /> 12.5%
 </span>
 </div>
 <p className="text-xs text-gray-500 mb-6">vs. ${(metrics.totalSales * 0.875).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} last month</p>
 </div>
 <div className="h-28 -mx-2 -mb-2">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={revenueData.slice(-10)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
 <defs>
 <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#FF6A1C" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#FF6A1C" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <Tooltip 
 content={({ active, payload }) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-black rounded-lg p-2 text-xs shadow-lg">
 <p className="text-gray-400 mb-1">{format(new Date(payload[0].payload.date), 'MMM d')}</p>
 <p className="font-bold text-white">${payload[0].value?.toLocaleString()}</p>
 </div>
 );
 }
 return null;
 }} 
 cursor={{ stroke: 'rgba(255,106,28,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
 />
 <Area type="monotone" dataKey="revenue" stroke="#FF6A1C" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 4, strokeWidth: 2, fill: '#000', stroke: '#FF6A1C' }} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Recent Orders */}
 <div className="bg-black rounded-xl p-5 flex flex-col">
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-sm font-semibold text-white flex items-center gap-2">
 <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center">
 <span className="w-2 h-2 bg-nova-500 rounded-sm"></span>
 </span>
 Recent Orders
 </h2>
 <Link to="/orders" className="text-xs font-semibold text-nova-500 hover:text-nova-400 transition-colors">
 View All
 </Link>
 </div>
 <div className="flex-1 flex flex-col gap-4 justify-between">
 {recentOrders.map((order: any, idx: number) => (
 <div key={order.id || idx} className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded bg-[#111111] flex items-center justify-center flex-shrink-0">
 <DocumentTextIcon className="w-4 h-4 text-nova-500" />
 </div>
 <div>
 <Link to={`/orders/${order.id}`} className="text-sm font-medium text-white hover:text-nova-400 transition-colors block">
 #{order.order_number}
 </Link>
 <p className="text-xs text-gray-400">{order.user?.first_name} {order.user?.last_name}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-xs text-gray-400 mb-0.5">{format(new Date(order.created_at || new Date()), 'MMM dd')}</p>
 <p className="text-sm font-medium text-nova-500">${Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
 </div>
 </div>
 ))}
 {recentOrders.length === 0 && !isLoading && (
 <div className="text-center text-sm text-gray-500 my-auto">No recent orders</div>
 )}
 </div>
 </div>

 {/* Customer Overview */}
 <div className="bg-black rounded-xl p-5 flex flex-col">
 <div className="flex items-center gap-2 mb-6">
 <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center">
 <span className="w-2 h-2 bg-nova-500 rounded-sm"></span>
 </span>
 <h2 className="text-sm font-semibold text-white">Customer Overview</h2>
 </div>
 <div className="grid grid-cols-2 gap-4 flex-1">
 <div className="bg-[#111111] rounded-lg p-3">
 <p className="text-xs text-gray-400 mb-1">Total Customers</p>
 <div className="flex items-end gap-2">
 <span className="text-xl font-bold text-white tracking-tight">{metrics.totalUsers?.toLocaleString() || 0}</span>
 <span className="flex items-center text-[10px] font-semibold text-success mb-1">
 <ArrowUpIcon className="w-2.5 h-2.5" /> 8.2%
 </span>
 </div>
 </div>
 <div className="bg-[#111111] rounded-lg p-3">
 <p className="text-xs text-gray-400 mb-1">New Customers</p>
 <div className="flex items-end gap-2">
 <span className="text-xl font-bold text-white tracking-tight">{Math.floor((metrics.totalUsers || 0) * 0.12).toLocaleString()}</span>
 <span className="flex items-center text-[10px] font-semibold text-success mb-1">
 <ArrowUpIcon className="w-2.5 h-2.5" /> 5.7%
 </span>
 </div>
 </div>
 <div className="bg-[#111111] rounded-lg p-3">
 <p className="text-xs text-gray-400 mb-1">Active Customers</p>
 <div className="flex items-end gap-2">
 <span className="text-xl font-bold text-white tracking-tight">{activeUsers.toLocaleString()}</span>
 <span className="flex items-center text-[10px] font-semibold text-success mb-1">
 79.3%
 </span>
 </div>
 </div>
 <div className="bg-[#111111] rounded-lg p-3">
 <p className="text-xs text-gray-400 mb-1">Repeat Rate</p>
 <div className="flex items-end gap-2">
 <span className="text-xl font-bold text-white tracking-tight">68.4%</span>
 <span className="flex items-center text-[10px] font-semibold text-success mb-1">
 <ArrowUpIcon className="w-2.5 h-2.5" /> 2.1%
 </span>
 </div>
 </div>
 </div>
 <button className="w-full mt-4 bg-nova-500/10 hover:bg-nova-500/20 border border-nova-500/30 text-nova-500 font-semibold text-sm py-2.5 rounded-lg transition-colors">
 Manage Customers
 </button>
 </div>
 </div>

 {/* Row 2: Analytics & Categories */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Revenue Analytics */}
 <div className="lg:col-span-2 bg-black rounded-xl p-5 flex flex-col">
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-sm font-semibold text-white flex items-center gap-2">
 <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center">
 <span className="w-2 h-2 bg-nova-500 rounded-sm"></span>
 </span>
 Revenue Analytics
 </h2>
 <div className="flex items-center gap-2 bg-[#111111] rounded-lg px-3 py-1">
 <span className="text-xs font-medium text-white">This Year</span>
 <ArrowDownIcon className="w-3 h-3 text-gray-400" />
 </div>
 </div>
 
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
 <div className="bg-[#111111] rounded-lg p-4">
 <p className="text-xs text-gray-400 mb-1">Gross Revenue</p>
 <p className="text-lg font-bold text-white tracking-tight mb-1">
 ${metrics.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </p>
 <span className="flex items-center text-[10px] font-semibold text-success">
 <ArrowUpIcon className="w-2.5 h-2.5 mr-0.5" /> 10.2%
 </span>
 </div>
 <div className="bg-[#111111] rounded-lg p-4">
 <p className="text-xs text-gray-400 mb-1">Net Revenue</p>
 <p className="text-lg font-bold text-white tracking-tight mb-1">
 ${(metrics.totalSales * 0.85).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </p>
 <span className="flex items-center text-[10px] font-semibold text-success">
 <ArrowUpIcon className="w-2.5 h-2.5 mr-0.5" /> 9.8%
 </span>
 </div>
 <div className="bg-[#111111] rounded-lg p-4">
 <p className="text-xs text-gray-400 mb-1">Avg. Order Value</p>
 <p className="text-lg font-bold text-white tracking-tight mb-1">
 ${metrics.totalOrders ? (metrics.totalSales / metrics.totalOrders).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
 </p>
 <span className="flex items-center text-[10px] font-semibold text-success">
 <ArrowUpIcon className="w-2.5 h-2.5 mr-0.5" /> 3.4%
 </span>
 </div>
 <div className="bg-[#111111] rounded-lg p-4">
 <p className="text-xs text-gray-400 mb-1">Total Orders</p>
 <p className="text-lg font-bold text-white tracking-tight mb-1">
 {metrics.totalOrders?.toLocaleString() || 0}
 </p>
 <span className="flex items-center text-[10px] font-semibold text-success">
 <ArrowUpIcon className="w-2.5 h-2.5 mr-0.5" /> 7.9%
 </span>
 </div>
 </div>

 <div className="h-64 flex-1">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={16}>
 <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
 <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => format(new Date(v), 'MMM')} />
 <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v/1000)+'K' : v}`} />
 <Tooltip 
 cursor={{ fill: '#111111' }}
 content={({ active, payload }) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-black rounded-lg p-2 text-xs shadow-lg flex flex-col items-center">
 <p className="text-gray-400 mb-1">{format(new Date(payload[0].payload.date), 'MMM')}</p>
 <p className="font-bold text-white bg-[#111111] px-2 py-1 rounded">${payload[0].value?.toLocaleString()}</p>
 </div>
 );
 }
 return null;
 }} 
 />
 <Bar dataKey="revenue" fill="#FF6A1C" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Sales by Category */}
 <div className="bg-black rounded-xl p-5 flex flex-col">
 <h2 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
 <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center">
 <span className="w-2 h-2 bg-nova-500 rounded-sm"></span>
 </span>
 Sales by Category
 </h2>
 <div className="flex-1 flex flex-col xl:flex-row items-center justify-center gap-8">
 <div className="relative w-40 h-40 flex-shrink-0">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={categoryData}
 cx="50%"
 cy="50%"
 innerRadius={50}
 outerRadius={70}
 paddingAngle={2}
 dataKey="value"
 stroke="none"
 >
 {categoryData.map((entry: any, index: number) => (
 <Cell key={`cell-${index}`} fill={entry.color || '#FF6A1C'} />
 ))}
 </Pie>
 <Tooltip 
 content={({ active, payload }) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-black p-2 rounded shadow-lg text-xs">
 <span className="text-white font-medium">{payload[0].name}: </span>
 <span className="text-gray-400">${Number(payload[0].value)?.toLocaleString()}</span>
 </div>
 )
 }
 return null;
 }}
 />
 </PieChart>
 </ResponsiveContainer>
 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
 <span className="text-xs text-white font-bold tracking-tight">${metrics.totalSales ? (metrics.totalSales > 1000 ? Math.floor(metrics.totalSales/1000)+','+Math.floor(metrics.totalSales%1000).toString().padStart(3,'0') : metrics.totalSales) : '0'}</span>
 <span className="text-[10px] text-gray-400">Total</span>
 </div>
 </div>
 
 <div className="w-full xl:w-auto flex flex-col gap-3">
 {categoryData.map((cat: any, i: number) => (
 <div key={i} className="flex items-center justify-between xl:justify-start gap-4">
 <div className="flex items-center gap-2 min-w-[100px]">
 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#FF6A1C' }}></div>
 <span className="text-xs text-gray-300">{cat.name}</span>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-xs font-mono text-gray-400 w-8">{cat.percentage}%</span>
 <span className="text-xs font-mono text-white w-16 text-right">${Number(cat.value).toLocaleString()}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Row 3: Top Products */}
 <div className="bg-black rounded-xl p-5">
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-sm font-semibold text-white flex items-center gap-2">
 <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center">
 <span className="w-2 h-2 bg-nova-500 rounded-sm"></span>
 </span>
 Top Products
 </h2>
 <Link to="/catalog" className="text-xs font-semibold text-nova-500 hover:text-nova-400 transition-colors">
 View All Products
 </Link>
 </div>
 
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse min-w-[800px]">
 <thead>
 <tr className="">
 <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">Product</th>
 <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">Category</th>
 <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">Sales</th>
 <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">Revenue</th>
 <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">Stock</th>
 <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">Status</th>
 <th className="pb-3 w-8"></th>
 </tr>
 </thead>
 <tbody>
 {topProducts.map((product: any, idx: number) => (
 <tr key={product.id || idx} className="/50 hover:bg-[#111111] transition-colors group">
 <td className="py-4 flex items-center gap-4 pr-4">
 <span className="text-xs font-medium text-gray-500 w-4">{idx + 1}</span>
 <div className="w-10 h-10 rounded bg-[#1a1a1a] flex-shrink-0 overflow-hidden">
 {product.primary_image_url || product.thumbnail_url ? (
 <img src={product.primary_image_url || product.thumbnail_url} alt="" className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <span className="w-6 h-6 border-2 rounded-full"></span>
 </div>
 )}
 </div>
 <span className="text-sm font-medium text-white truncate max-w-[200px]">{product.name || product.product_name}</span>
 </td>
 <td className="py-4 text-sm text-gray-400">{product.category?.name || 'Uncategorized'}</td>
 <td className="py-4 text-sm text-white font-medium">{product.quantity_sold?.toLocaleString() || 0}</td>
 <td className="py-4 text-sm text-white font-medium">${Number(product.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
 <td className="py-4 text-sm text-gray-400">{product.stock_quantity || 0} in stock</td>
 <td className="py-4">
 <span className="inline-flex items-center text-xs font-medium text-nova-500 bg-nova-500/10 border border-nova-500/20 px-2.5 py-0.5 rounded-full">
 Active
 </span>
 </td>
 <td className="py-4">
 <button className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
 <EllipsisHorizontalIcon className="w-5 h-5" />
 </button>
 </td>
 </tr>
 ))}
 {topProducts.length === 0 && !isLoading && (
 <tr>
 <td colSpan={7} className="py-8 text-center text-gray-500 text-sm">No products found for this period.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
}
