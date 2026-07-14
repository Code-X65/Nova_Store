import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomerEvents, fetchTopViewedProducts, type CustomerEvent } from './api/events';
import { subDays, format } from 'date-fns';

export default function CustomerEvents() {
  const to = useMemo(() => new Date().toISOString(), []);
  const from = useMemo(() => subDays(new Date(), 30).toISOString(), []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-crm-events', from, to],
    queryFn: () => fetchCustomerEvents({ page: 1, limit: 50, fromDate: from, toDate: to }),
  });

  const events: CustomerEvent[] = data?.events || [];

  const eventIcon = (type: string) => {
    const map: Record<string, string> = {
      page_view: '👁️',
      product_view: '📦',
      cart_add: '🛒',
      cart_remove: '🗑️',
      checkout_start: '💳',
      checkout_abandon: '❌',
      search: '🔍',
      wishlist_add: '❤️',
      review_submit: '⭐',
    };
    return map[type] || '📌';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Customer Events</h1>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-white/10">
              <tr>
                <th className="text-left p-3">Event</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-white/5">
                  <td className="p-3 text-xl">{eventIcon(e.event_type)}</td>
                  <td className="p-3 text-gray-300 font-mono text-xs">{e.event_type}</td>
                  <td className="p-3 text-gray-300">{e.customer ? `${e.customer.first_name} ${e.customer.last_name}` : 'Anonymous'}</td>
                  <td className="p-3 text-gray-400">{e.product?.name || '—'}</td>
                  <td className="p-3 text-gray-400 text-xs">{format(new Date(e.created_at), 'yyyy-MM-dd HH:mm')}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">No events found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
