import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchCampaigns, deleteCampaign, type Campaign } from './api/campaigns';

export default function CampaignsList() {
  const qc = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => fetchCampaigns({ page: 1, limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      toast.success('Campaign deleted');
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    },
    onError: () => toast.error('Failed to delete campaign'),
  });

  const campaigns = response?.data || [];

  const columns = useMemo<ColumnDef<Campaign>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Campaign',
      cell: (info) => <span className="font-medium text-white">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'scope',
      header: 'Scope',
      cell: (info) => <span className="text-gray-400 capitalize">{(info.getValue() as string).replace('_', ' ')}</span>
    },
    {
      accessorKey: 'discount_value',
      header: 'Discount',
      cell: ({ row }) => {
        const { discount_type, discount_value } = row.original;
        return <span className="font-medium text-white">{discount_type === 'percentage' ? `${discount_value}%` : `₦${discount_value}`}</span>;
      }
    },
    {
      id: 'window',
      header: 'Window',
      cell: ({ row }) => (
        <span className="text-gray-400 text-xs">
          {format(new Date(row.original.starts_at), 'MMM d')} — {format(new Date(row.original.ends_at), 'MMM d, yyyy')}
        </span>
      )
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const now = new Date();
        const ended = new Date(row.original.ends_at) < now;
        const notStarted = new Date(row.original.starts_at) > now;
        let label = 'Active';
        let color = 'text-emerald-400 bg-emerald-500/10';
        if (!row.original.is_active) { label = 'Disabled'; color = 'text-gray-400 bg-white/5'; }
        else if (ended) { label = 'Ended'; color = 'text-gray-400 bg-white/5'; }
        else if (notStarted) { label = 'Scheduled'; color = 'text-amber-400 bg-amber-500/10'; }
        return <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${color}`}>{label}</span>;
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={`/campaigns/${row.original.id}`} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10">
            <PencilIcon className="w-4 h-4" />
          </Link>
          <button
            onClick={() => { if (confirm('Delete this campaign permanently?')) deleteMutation.mutate(row.original.id); }}
            className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-red-500/10"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-sm text-gray-400 mt-1">Time-boxed flash sales and promotional discounts.</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      <div className="bg-black rounded-xl p-4 border border-white/10 min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-gray-400 py-20">Loading...</div>
        ) : (
          <DataTable data={campaigns} columns={columns} pageSize={15} />
        )}
      </div>
    </div>
  );
}
