import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import type { AuditLog, AuditSeverity, AuditActionType } from '@/shared/api/types';

const SEVERITY_BADGE: Record<AuditSeverity, string> = {
  critical: 'text-danger bg-danger/10',
  warning: 'text-nova-400 bg-nova-400/10',
  info: 'text-muted-foreground bg-white/5',
};

const ACTION_TYPES: AuditActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'STATUS_CHANGE', 'OTHER'];

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [logType, setLogType] = useState('activity');
  const [severity, setSeverity] = useState('');
  const [actionType, setActionType] = useState('');
  const [actor, setActor] = useState('');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (severity) p.set('severity', severity);
    if (actionType) p.set('actionType', actionType);
    if (actor) p.set('actor', actor);
    if (q) p.set('q', q);
    return p.toString();
  }, [page, severity, actionType, actor, q]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-audit', logType, filters],
    queryFn: async () => {
      let endpoint = '/admin/audit';
      if (logType === 'auth') endpoint = '/admin/audit/auth';
      if (logType === 'admin-auth') endpoint = '/admin/audit/admin-auth';
      if (logType === 'activity') endpoint = `/admin/audit?${filters}`;
      const { data } = await api.get(endpoint);
      return data.data;
    },
  });

  const logs: AuditLog[] = response?.logs || [];

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (logType !== 'activity') {
      return [
        { accessorKey: 'created_at', header: 'Timestamp', cell: (i) => <span className="text-xs text-muted-foreground">{format(new Date(i.getValue() as string), 'MMM d, HH:mm:ss')}</span> },
        { header: 'Event', cell: ({ row }) => <span className="font-semibold text-white">{row.original.action_label || row.original.action}</span> },
        { header: 'Actor', cell: ({ row }) => (
          <span className="text-xs text-gray-300">
            {row.original.actor_full_name || 'System'}
            {row.original.actor_role && <span className="text-muted-foreground"> ({row.original.actor_role})</span>}
          </span>
        ) },
        { accessorKey: 'ip_address', header: 'IP Address', cell: (i) => <span className="text-xs font-mono text-muted-foreground">{i.getValue() as string}</span> },
      ];
    }
    return [
      {
        accessorKey: 'created_at',
        header: 'Timestamp',
        cell: (i) => <span className="text-xs text-muted-foreground">{format(new Date(i.getValue() as string), 'MMM d, HH:mm:ss')}</span>,
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: (i) => {
          const s = (i.getValue() as AuditSeverity) || 'info';
          return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_BADGE[s]}`}>{s}</span>;
        },
      },
      {
        accessorKey: 'action_type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.action_type_label || row.original.action_type || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <span className="font-semibold text-white">
            {row.original.action_label || row.original.action}
          </span>
        ),
      },
      {
        accessorKey: 'entity_type',
        header: 'Entity',
        cell: ({ row }) => (
          <span className="text-sm text-gray-300">
            {row.original.entity_type || row.original.resourceType || '—'}
            {row.original.entity_label ? (
              <span className="text-muted-foreground"> ({row.original.entity_label})</span>
            ) : row.original.entity_id || row.original.resourceId ? (
              <span className="text-muted-foreground"> ({row.original.entity_id || row.original.resourceId})</span>
            ) : null}
          </span>
        ),
      },
      {
        header: 'Actor',
        cell: ({ row }) => (
          <span className="text-xs text-gray-300">
            {row.original.actor_full_name || 'System'}
            {row.original.actor_role && <span className="text-muted-foreground"> ({row.original.actor_role})</span>}
          </span>
        ),
      },
      {
        accessorKey: 'summary',
        header: 'Summary',
        cell: ({ row }) => {
          const log = row.original;
          const hasDelta = Array.isArray(log.delta) && log.delta.length > 0;
          return (
            <div>
              <p className="text-xs text-gray-300 line-clamp-2">{log.summary || '—'}</p>
              {hasDelta && (
                <button
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  className="text-[11px] text-nova-400 hover:text-nova-300 mt-0.5"
                >
                  {expanded === log.id ? 'Hide changes' : `Show ${log.delta!.length} change(s)`}
                </button>
              )}
              {expanded === log.id && hasDelta && (
                <ul className="mt-1 space-y-0.5">
                  {log.delta!.map((d, idx) => (
                    <li key={idx} className="text-[11px] text-muted-foreground">
                      <span className="text-gray-300">{d.label}</span>: {JSON.stringify(d.before)} → {JSON.stringify(d.after)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'ip_address',
        header: 'IP',
        cell: (i) => <span className="text-xs font-mono text-muted-foreground">{i.getValue() as string}</span>,
      },
    ];
  }, [logType, expanded]);

  const doExport = async (format: 'csv' | 'pdf') => {
    const { data } = await api.get(`/admin/audit/export?format=${format}&${filters}`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isActivity = logType === 'activity';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Review system activity and security events.</p>
        </div>
        {isActivity && (
          <div className="flex gap-2">
            <button onClick={() => doExport('csv')} className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Export CSV</button>
            <button onClick={() => doExport('pdf')} className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Export PDF</button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { id: 'activity', label: 'System Activity' },
          { id: 'admin-auth', label: 'Admin Logins' },
          { id: 'auth', label: 'Customer Logins' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setLogType(tab.id); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              logType === tab.id ? 'bg-nova-500/20 text-nova-400 border border-nova-500/30' : 'bg-surface-2 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isActivity && (
        <div className="flex flex-wrap gap-3 items-end glass-card p-4 rounded-xl border">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Search</label>
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="summary / action / entity"
              className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white w-56 focus:outline-none focus:ring-1 focus:ring-nova-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Severity</label>
            <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white">
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Action Type</label>
            <select value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }} className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white">
              <option value="">All</option>
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Actor</label>
            <input
              value={actor}
              onChange={(e) => { setActor(e.target.value); setPage(1); }}
              placeholder="name / role / id"
              className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white w-44 focus:outline-none focus:ring-1 focus:ring-nova-500"
            />
          </div>
          <button onClick={() => { setQ(''); setSeverity(''); setActionType(''); setActor(''); setPage(1); }} className="text-xs text-muted-foreground hover:text-white">Clear</button>
        </div>
      )}

      <div className="glass-card p-4 rounded-xl border space-y-4">
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
