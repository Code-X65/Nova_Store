import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  fetchAbandonedCarts,
  fetchCartRecoverySettings,
  updateCartRecoverySettings,
  triggerCartRecoveryNow,
  type CartRecoveryLog,
} from './api/cart-recovery';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<CartRecoveryLog>();

const columns = [
  columnHelper.display({
    id: 'customer',
    header: 'Customer',
    cell: (info) => {
      const log = info.row.original;
      return (
        <span className="text-gray-300">
          {log.user ? `${log.user.first_name} ${log.user.last_name} (${log.user.email})` : log.user_id}
        </span>
      );
    },
  }),
  columnHelper.accessor('sent_at', {
    header: 'Sent',
    cell: (info) => <span className="text-gray-400">{format(new Date(info.getValue()), 'MMM d, yyyy HH:mm')}</span>,
  }),
  columnHelper.accessor('recovered', {
    header: 'Status',
    cell: (info) => (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${info.getValue() ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
        {info.getValue() ? 'Recovered' : 'Pending'}
      </span>
    ),
  }),
];

export default function AbandonedCarts() {
  const qc = useQueryClient();

  const { data: logResponse, isLoading } = useQuery({
    queryKey: ['admin-cart-recovery'],
    queryFn: () => fetchAbandonedCarts({ page: 1, limit: 200 }),
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-cart-recovery-settings'],
    queryFn: fetchCartRecoverySettings,
  });

  const settingsMutation = useMutation({
    mutationFn: updateCartRecoverySettings,
    onSuccess: () => {
      toast.success('Settings updated');
      qc.invalidateQueries({ queryKey: ['admin-cart-recovery-settings'] });
    },
    onError: () => toast.error('Failed to update settings'),
  });

  const triggerMutation = useMutation({
    mutationFn: triggerCartRecoveryNow,
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} reminder(s) out of ${result.scanned} abandoned cart(s).`);
      qc.invalidateQueries({ queryKey: ['admin-cart-recovery'] });
    },
    onError: () => toast.error('Failed to run cart recovery job'),
  });

  const logs = logResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abandoned Carts</h1>
          <p className="text-sm text-gray-400 mt-1">Reminder emails sent to customers who left items in their cart.</p>
        </div>
        <button
          onClick={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending}
          className="btn-primary disabled:opacity-50"
        >
          {triggerMutation.isPending ? 'Running…' : 'Run Now'}
        </button>
      </div>

      {settings && (
        <div className="bg-black rounded-xl p-4 border border-white/10 flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => settingsMutation.mutate({ enabled: e.target.checked })}
              className="rounded bg-white/5 text-nova-500 focus:ring-nova-500"
            />
            <span className="text-sm font-medium text-white">Enabled</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            Remind after
            <input
              type="number"
              min={1}
              defaultValue={settings.delayHours}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value && value !== settings.delayHours) settingsMutation.mutate({ delayHours: value });
              }}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white"
            />
            hours of inactivity
          </label>
        </div>
      )}

      <div className="bg-black rounded-xl overflow-hidden border border-white/10">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No reminders sent yet.</div>
        ) : (
          <DataTable columns={columns} data={logs} />
        )}
      </div>
    </div>
  );
}
