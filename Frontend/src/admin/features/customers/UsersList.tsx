import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function UsersList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: { page, limit: 20, search }
      });
      return data.data;
    }
  });

  const users = Array.isArray(response) ? response : response?.users || [];

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-white">{row.original.first_name} {row.original.last_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      )
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: (info) => <span className="text-muted-foreground">{info.getValue() as string || 'N/A'}</span>
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: (info) => <span className="text-muted-foreground">{format(new Date(info.getValue() as string), 'MMM d, yyyy')}</span>
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link to={`/admin/customers/${row.original.id}`} className="text-nova-500 hover:text-nova-400 text-sm font-medium">
          View Details
        </Link>
      )
    }
  ], []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage and view your registered customers.</p>
      </div>

      <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
        />

        <div className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">Loading...</div>
          ) : (
            <DataTable data={users} columns={columns} pageSize={15} />
          )}
        </div>
      </div>
    </div>
  );
}