import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { StatCard } from '@/shared/ui/StatCard';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { ShoppingBagIcon, TruckIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function OrderDashboard() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics', 'order-stats'],
    queryFn: async () => {
      // getOrdersReport returns { summary: { totalOrders, totalAmount, statusBreakdown }, trend: [...] }
      const { data } = await api.get('/admin/dashboard/order-stats', {
        params: { period: 'month' }
      });
      return data.data;
    }
  });

  const { data: dispatchData, isLoading: dispatchLoading } = useQuery({
    queryKey: ['orders', 'dispatch-queue-preview'],
    queryFn: async () => {
      const { data } = await api.get('/orders/admin/dispatch-queue');
      return data.data; // { orders }
    }
  });

  const { data: recentOrdersData, isLoading: recentLoading } = useQuery({
    queryKey: ['orders', 'recent-preview'],
    queryFn: async () => {
      const { data } = await api.get('/orders/admin/list', {
        params: { limit: 5 }
      });
      return data.data; // { orders }
    }
  });

  const breakdown = statsData?.summary?.statusBreakdown || {};
  const pending = breakdown.find((b: any) => b.status === 'pending')?.count || 0;
  const processing = breakdown.find((b: any) => b.status === 'processing')?.count || 0;
  const dispatchedToday = breakdown.find((b: any) => b.status === 'shipped')?.count || 0; // rough proxy for now

  const dispatchOrders = dispatchData?.orders?.slice(0, 5) || [];
  const recentOrders = recentOrdersData?.orders || [];

  const columns = [
    {
      accessorKey: 'id',
      header: 'Order ID',
      cell: (info: any) => <span className="font-medium text-white">{info.getValue().split('-')[0]}</span>
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: (info: any) => <span className="text-muted-foreground">{format(new Date(info.getValue()), 'MMM d, HH:mm')}</span>
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }: any) => <span className="text-white">{row.original.user?.first_name || 'Guest'}</span>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => {
        const status = info.getValue();
        return (
          <span className={clsx(
            "px-2 py-1 rounded text-xs font-semibold tracking-wider uppercase",
            status === 'pending' ? 'bg-warning/10 text-warning' :
            status === 'processing' ? 'bg-nova-500/10 text-nova-400' :
            status === 'shipped' ? 'bg-purple-500/10 text-purple-400' :
            'bg-surface-2 text-white'
          )}>
            {status}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <Link to={`/admin/orders/${row.original.id}`} className="text-nova-500 hover:text-nova-400 text-sm font-medium">
          View
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fulfillment Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor incoming orders and the dispatch queue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Pending Action"
          value={pending}
          icon={<ClockIcon className="w-6 h-6" />}
          loading={statsLoading}
        />
        <StatCard
          title="In Processing"
          value={processing}
          icon={<ShoppingBagIcon className="w-6 h-6" />}
          loading={statsLoading}
        />
        <StatCard
          title="Shipped (Last 30d)"
          value={dispatchedToday}
          icon={<TruckIcon className="w-6 h-6" />}
          loading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Dispatch Queue</h3>
            <Link to="/admin/orders/dispatch" className="text-sm text-nova-500 hover:text-nova-400">View All</Link>
          </div>
          
          <div className="space-y-3">
            {dispatchLoading ? (
              <p className="text-muted-foreground text-sm">Loading queue...</p>
            ) : dispatchOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No orders ready for dispatch.</p>
            ) : (
              dispatchOrders.map((order: any) => (
                <div key={order.id} className="p-3 bg-surface-2 rounded-lg border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Order #{order.id.split('-')[0]}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  <Link to={`/admin/orders/${order.id}`} className="btn-primary py-1 px-3 text-xs">
                    Process
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
            <Link to="/admin/orders" className="text-sm text-nova-500 hover:text-nova-400">View All</Link>
          </div>
          
          <div className="overflow-x-auto -mx-6 px-6">
            <DataTable data={recentOrders} columns={columns as any} pageSize={5} />
          </div>
        </div>
      </div>
    </div>
  );
}
