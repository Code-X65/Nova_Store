import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [logType, setLogType] = useState('activity'); // activity, auth, admin-auth

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-audit', logType, page],
    queryFn: async () => {
      let endpoint = '/admin/audit';
      if (logType === 'auth') endpoint = '/admin/audit/auth';
      if (logType === 'admin-auth') endpoint = '/admin/audit/admin-auth';

      const { data } = await api.get(endpoint, {
        params: { page, limit: 20 }
      });
      return data.data; // { logs }
    }
  });

  const logs = response?.logs || [];

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (logType === 'activity') {
      return [
        {
          accessorKey: 'created_at',
          header: 'Timestamp',
          cell: (info) => <span className="text-xs text-muted-foreground">{format(new Date(info.getValue() as string), 'MMM d, HH:mm:ss')}</span>
        },
        {
          accessorKey: 'user_id',
          header: 'User/Admin ID',
          cell: (info) => <span className="text-xs font-mono text-nova-400">{info.getValue() as string}</span>
        },
        {
          accessorKey: 'action',
          header: 'Action',
          cell: (info) => <span className="font-semibold text-white">{info.getValue() as string}</span>
        },
        {
          accessorKey: 'entity_type',
          header: 'Entity',
          cell: ({ row }) => (
            <span className="text-sm text-gray-300">
              {row.original.entity_type} <span className="text-muted-foreground">({row.original.entity_id})</span>
            </span>
          )
        }
      ];
    } else {
      return [
        {
          accessorKey: 'created_at',
          header: 'Timestamp',
          cell: (info) => <span className="text-xs text-muted-foreground">{format(new Date(info.getValue() as string), 'MMM d, HH:mm:ss')}</span>
        },
        {
          accessorKey: 'email',
          header: 'Email',
          cell: (info) => <span className="text-sm text-white">{info.getValue() as string}</span>
        },
        {
          accessorKey: 'event_type',
          header: 'Event',
          cell: ({ row }) => {
            const ev = row.original.event_type;
            const success = row.original.status === 'success';
            return (
              <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${success ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                {ev}
              </span>
            );
          }
        },
        {
          accessorKey: 'ip_address',
          header: 'IP Address',
          cell: (info) => <span className="text-xs font-mono text-muted-foreground">{info.getValue() as string}</span>
        }
      ];
    }
  }, [logType]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Review system activity and security events.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'activity', label: 'System Activity' },
          { id: 'admin-auth', label: 'Admin Logins' },
          { id: 'auth', label: 'Customer Logins' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setLogType(tab.id); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              logType === tab.id 
                ? 'bg-nova-500/20 text-nova-400 border border-nova-500/30' 
                : 'bg-surface-2 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
        <div className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">Loading logs...</div>
          ) : (
            <DataTable data={logs} columns={columns} pageSize={15} />
          )}
        </div>
      </div>
    </div>
  );
}