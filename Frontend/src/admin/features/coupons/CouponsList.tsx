import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function CouponsList() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-coupons', page],
    queryFn: async () => {
      const { data } = await api.get('/admin/coupons', {
        params: { page, limit: 20 }
      });
      return data.data; // { coupons }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/coupons/${id}`);
    },
    onSuccess: () => {
      toast.success('Coupon deleted');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: () => toast.error('Failed to delete coupon')
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, deactivate }: { id: string, deactivate: boolean }) => {
      if (deactivate) {
        return api.post(`/admin/coupons/${id}/deactivate`);
      } else {
        return api.patch(`/admin/coupons/${id}`, { is_active: true });
      }
    },
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: () => toast.error('Failed to update status')
  });

  const coupons = response?.coupons || [];

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: (info) => <span className="font-bold text-nova-400 tracking-wider uppercase bg-nova-500/10 px-2 py-1 rounded">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'discount_type',
      header: 'Type',
      cell: (info) => <span className="text-white capitalize">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'discount_value',
      header: 'Value',
      cell: ({ row }) => {
        const type = row.original.discount_type;
        const val = row.original.discount_value;
        return <span className="font-medium text-white">{type === 'percentage' ? `${val}%` : `$${val}`}</span>
      }
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const active = row.original.is_active;
        const expired = row.original.end_date ? new Date(row.original.end_date) < new Date() : false;
        
        let displayStatus = active ? 'Active' : 'Inactive';
        let color = active ? 'text-success bg-success/10' : 'text-muted-foreground bg-surface-2';
        
        if (expired) {
          displayStatus = 'Expired';
          color = 'text-danger bg-danger/10';
        }

        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${color}`}>
            {displayStatus}
          </span>
        );
      }
    },
    {
      accessorKey: 'end_date',
      header: 'Expires',
      cell: (info) => {
        const date = info.getValue() as string;
        if (!date) return <span className="text-muted-foreground">Never</span>;
        return <span className="text-muted-foreground">{format(new Date(date), 'MMM d, yyyy')}</span>
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const active = row.original.is_active;
        return (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => toggleStatusMutation.mutate({ id: row.original.id, deactivate: active })}
              className="px-2 py-1 text-xs font-medium text-white bg-surface-2 rounded hover:bg-white/10"
            >
              {active ? 'Deactivate' : 'Activate'}
            </button>
            <Link
              to={`/admin/coupons/${row.original.id}`}
              className="p-1.5 text-muted-foreground hover:text-white rounded-md hover:bg-surface-2"
            >
              <PencilIcon className="w-4 h-4" />
            </Link>
            <button
              onClick={() => {
                if (confirm('Delete this coupon permanently?')) {
                  deleteMutation.mutate(row.original.id);
                }
              }}
              className="p-1.5 text-muted-foreground hover:text-danger rounded-md hover:bg-danger/10"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons & Promotions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage discount codes and promotional campaigns.</p>
        </div>
        <Link to="/admin/coupons/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Create Coupon
        </Link>
      </div>

      <div className="glass-card p-4 rounded-xl border border-white/5 h-[600px] group-hover-visible">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-muted-foreground">Loading...</div>
        ) : (
          <DataTable data={coupons} columns={columns} pageSize={15} />
        )}
      </div>
    </div>
  );
}