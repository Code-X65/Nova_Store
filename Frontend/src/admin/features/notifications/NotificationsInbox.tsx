import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import type { Notification } from '@/shared/api/types';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

export default function NotificationsInbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'inbox', filter, page],
    queryFn: async () => {
      const { data } = await api.get(`/notifications?isRead=${filter === 'unread' ? 'false' : 'true'}&page=${page}&limit=${limit}`);
      return data.data;
    },
  });

  const notifications: Notification[] = data?.notifications || [];
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const columns: ColumnDef<Notification>[] = [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: (i) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(i.getValue() as string), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: ({ row }) => (
        <span className={clsx(
          'px-2 py-0.5 rounded text-[11px] font-semibold',
          row.original.read ? 'bg-white/5 text-muted-foreground' : 'bg-nova-500/20 text-nova-400'
        )}>
          {row.original.read ? 'Read' : 'Unread'}
        </span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: (i) => <span className="font-semibold text-white">{i.getValue() as string}</span>,
    },
    {
      accessorKey: 'message',
      header: 'Message',
      cell: (i) => <span className="text-sm text-gray-300 line-clamp-2">{i.getValue() as string}</span>,
    },
    {
      header: 'Severity',
      cell: ({ row }) => {
        const s = row.original.severity || 'info';
        const colors: Record<string, string> = {
          critical: 'text-red-400 bg-red-400/15',
          warning: 'text-amber-400 bg-amber-400/15',
          info: 'text-sky-300 bg-sky-300/15',
        };
        return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${colors[s]}`}>{s}</span>;
      },
    },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {!row.original.read && (
            <button
              onClick={() => markReadMutation.mutate(row.original.id)}
              className="p-1 text-muted hover:text-nova-400 transition-colors"
              title="Mark as read"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => dismissMutation.mutate(row.original.id)}
            className="p-1 text-muted hover:text-danger transition-colors"
            title="Dismiss"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage your in-app notifications.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-[#111111] p-0.5">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filter === f ? 'bg-nova-500/20 text-nova-400' : 'text-muted-foreground hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>
          {filter === 'unread' && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : 'No notifications'}
          </p>
        </div>
        <div className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">Loading notifications...</div>
          ) : (
            <DataTable data={notifications} columns={columns} pageSize={limit} disablePagination />
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white disabled:opacity-50 hover:bg-white/10 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white disabled:opacity-50 hover:bg-white/10 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
