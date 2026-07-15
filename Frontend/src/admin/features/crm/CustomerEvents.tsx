import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';
import { fetchCustomerEvents, fetchTopViewedProducts, type CustomerEvent } from './api/events';
import { subDays, format } from 'date-fns';

const columnHelper = createColumnHelper<CustomerEvent>();

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

  const columns = useMemo(() => [
    columnHelper.accessor('event_type', {
      id: 'icon',
      header: 'Event',
      cell: (info) => <span className="text-xl">{eventIcon(info.getValue())}</span>,
    }),
    columnHelper.accessor('event_type', {
      id: 'type',
      header: 'Type',
      cell: (info) => <span className="text-gray-300 font-mono text-xs">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'customer',
      header: 'Customer',
      cell: (info) => {
        const e = info.row.original;
        return <span className="text-gray-300">{e.customer ? `${e.customer.first_name} ${e.customer.last_name}` : 'Anonymous'}</span>;
      },
    }),
    columnHelper.display({
      id: 'product',
      header: 'Product',
      cell: (info) => <span className="text-gray-400">{info.row.original.product?.name || '—'}</span>,
    }),
    columnHelper.accessor('created_at', {
      header: 'Time',
      cell: (info) => <span className="text-gray-400 text-xs">{format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm')}</span>,
    }),
  ], []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Customer Events</h1>

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
