import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function UserDetail() {
  const { id } = useParams();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: async () => {
      // Might not exist directly, but assuming standard REST pattern
      const { data } = await api.get(`/admin/users/${id}`).catch(() => ({ data: { data: null } }));
      return data.data;
    }
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-user-orders', id],
    queryFn: async () => {
      const { data } = await api.get('/orders/admin/list', { params: { userId: id } });
      return data.data;
    }
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading user details...</div>;
  if (!user) return <div className="p-8 text-danger">User not found.</div>;

  const orders = ordersData?.orders || [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{user.first_name} {user.last_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Customer Profile</p>
        </div>
        <Link to="/admin/customers" className="px-4 py-2 bg-surface-2 hover:bg-white/10 text-white rounded-lg text-sm transition-colors">
          &larr; Back to Customers
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
            <h3 className="font-semibold text-white border-b border-white/10 pb-2">Contact Info</h3>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-white font-medium break-all">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm text-white font-medium">{user.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined Date</p>
              <p className="text-sm text-white font-medium">{format(new Date(user.created_at), 'PPP')}</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
            <h3 className="font-semibold text-white border-b border-white/10 pb-2">Order History</h3>
            
            {ordersLoading ? (
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">This customer has not placed any orders yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => (
                  <div key={order.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Order #{order.id.split('-')[0]}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-success">${Number(order.total_amount).toFixed(2)}</p>
                      <p className="text-xs uppercase font-medium text-nova-400 tracking-wider">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}