import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHeatmapSummary, type HeatmapSummaryEvent } from './api/heatmaps';
import { subDays, format } from 'date-fns';

export default function CustomerHeatmaps() {
  const to = useMemo(() => new Date().toISOString(), []);
  const from = useMemo(() => subDays(new Date(), 7).toISOString(), []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-heatmap', from, to],
    queryFn: () => fetchHeatmapSummary(from, to),
  });

  const events: HeatmapSummaryEvent[] = data || [];

  const eventColor = (type: string) => {
    const map: Record<string, string> = {
      page_view: 'bg-blue-500/10 text-blue-400',
      product_view: 'bg-purple-500/10 text-purple-400',
      cart_add: 'bg-emerald-500/10 text-emerald-400',
      cart_remove: 'bg-red-500/10 text-red-400',
      checkout_start: 'bg-yellow-500/10 text-yellow-400',
      checkout_abandon: 'bg-orange-500/10 text-orange-400',
      search: 'bg-cyan-500/10 text-cyan-400',
      wishlist_add: 'bg-pink-500/10 text-pink-400',
      review_submit: 'bg-green-500/10 text-green-400',
    };
    return map[type] || 'bg-gray-500/10 text-gray-400';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Behavior Heatmaps</h1>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-white/10">
              <tr>
                <th className="text-left p-3">Event</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${eventColor(e.event_type)}`}>{e.event_type}</span></td>
                  <td className="p-3 text-gray-300">{e.product_name || '—'}</td>
                  <td className="p-3 text-gray-400">{e.category_name || '—'}</td>
                  <td className="p-3 text-gray-300">{e.customer}</td>
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
