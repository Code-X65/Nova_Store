import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';
import { fetchHeatmapSummary, type HeatmapSummaryEvent } from './api/heatmaps';
import { subDays, format } from 'date-fns';

const columnHelper = createColumnHelper<HeatmapSummaryEvent>();

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

  const columns = useMemo(() => [
    columnHelper.accessor('event_type', {
      header: 'Event',
      cell: (info) => <span className={`px-2 py-1 rounded text-xs ${eventColor(info.getValue())}`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('product_name', {
      header: 'Product',
      cell: (info) => <span className="text-gray-300">{info.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('category_name', {
      header: 'Category',
      cell: (info) => <span className="text-gray-400">{info.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('customer', {
      header: 'Customer',
      cell: (info) => <span className="text-gray-300">{info.getValue()}</span>,
    }),
    columnHelper.accessor('created_at', {
      header: 'Time',
      cell: (info) => <span className="text-gray-400 text-xs">{format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm')}</span>,
    }),
  ], []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Behavior Heatmaps</h1>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <DataTable columns={columns} data={events} />
        )}
      </div>
    </div>
  );
}
