import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import toast from 'react-hot-toast';
import type { AuditLog, AuditSeverity, AuditActionType, AuditDeltaEntry } from '@/shared/api/types';

const SEVERITY_BADGE: Record<AuditSeverity, string> = {
  critical: 'text-red-400 bg-red-400/15',
  warning: 'text-amber-400 bg-amber-400/15',
  info: 'text-sky-300 bg-sky-300/15',
};

const ACTION_TYPES: AuditActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'STATUS_CHANGE', 'OTHER'];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(v => formatValue(v)).join(', ');
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function renderDeltaValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string' && value.length > 60) return value.slice(0, 60) + '…';
  return String(value);
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [logType, setLogType] = useState('activity');
  const [severity, setSeverity] = useState('');
  const [actionType, setActionType] = useState('');
  const [actor, setActor] = useState('');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const limit = 20;

  const filters = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (severity) p.set('severity', severity);
    if (actionType) p.set('actionType', actionType);
    if (actor) p.set('actor', actor);
    if (q) p.set('q', q);
    if (dateFrom) p.set('fromDate', dateFrom);
    if (dateTo) p.set('toDate', dateTo);
    return p.toString();
  }, [page, severity, actionType, actor, q, dateFrom, dateTo]);

  const [verifyResult, setVerifyResult] = useState<{
    total: number; verified: boolean; verifiedCount: number; brokenCount: number;
    broken: { id: string; created_at: string; linkOk: boolean; hashOk: boolean }[];
    verifiedAt: string;
  } | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; data: typeof verifyResult }>('/admin/audit/verify');
      return data.data;
    },
    onSuccess: (data) => {
      setVerifyResult(data);
      if (data?.verified) toast.success('Audit chain verified — no tampering detected');
      else toast.error(`Audit chain broken: ${data?.brokenCount} row(s) failed verification`);
    },
    onError: () => toast.error('Failed to verify audit chain'),
  });

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ['admin-audit', logType, filters],
    queryFn: async () => {
      if (logType === 'catalog') {
        const { data } = await api.get(`/admin/audit/catalog?${filters}`);
        return data.data;
      }
      let endpoint = '/admin/audit';
      if (logType === 'auth') endpoint = '/admin/audit/auth';
      if (logType === 'admin-auth') endpoint = '/admin/audit/admin-auth';
      if (logType === 'activity') endpoint = `/admin/audit?${filters}`;
      const { data } = await api.get(endpoint);
      return data.data;
    },
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const logs: AuditLog[] = response?.logs || [];
  const total = response?.total || 0;
  const currentPage = response?.page || page;
  const pageLimit = response?.limit || limit;
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));

  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageLimit + 1;
  const endIdx = Math.min(currentPage * pageLimit, total);

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => {
    const baseColumns: ColumnDef<AuditLog>[] = [
      {
        accessorKey: 'created_at',
        header: 'Timestamp',
        cell: (i) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(i.getValue() as string), 'MMM d, HH:mm:ss')}
          </span>
        ),
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: (i) => {
          const s = (i.getValue() as AuditSeverity) || 'info';
          return (
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_BADGE[s]}`}>
              {s}
            </span>
          );
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
          <span className="font-semibold text-white">{row.original.human_readable || row.original.action_label || row.original.action}</span>
        ),
      },
      {
        header: 'Entity',
        cell: ({ row }) => {
          const log = row.original;
          const label = log.resource_label || log.entity_label;
          const id = log.resourceId || log.entity_id;
          return (
            <span className="text-sm text-gray-300">
              {log.resourceType || log.entity_type || '—'}
              {label ? <span className="text-muted-foreground"> ({label})</span> : id ? <span className="text-muted-foreground"> ({id})</span> : null}
            </span>
          );
        },
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
        header: 'Summary',
        cell: ({ row }) => {
          const log = row.original;
          const hasDelta = Array.isArray(log.delta) && log.delta.length > 0;
          return (
            <div className="max-w-md">
              <p className="text-xs text-gray-300 line-clamp-2">{log.summary || '—'}</p>
              {hasDelta && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedLog(selectedLog?.id === log.id ? null : log); }}
                  className="text-[11px] text-nova-400 hover:text-nova-300 mt-0.5"
                >
                  {selectedLog?.id === log.id ? 'Hide details' : `View ${log.delta!.length} change(s)`}
                </button>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'ip_address',
        header: 'IP',
        cell: (i) => <span className="text-xs font-mono text-muted-foreground">{i.getValue() as string || '—'}</span>,
      },
    ];
    return baseColumns;
  }, [selectedLog]);

  const isActivity = logType === 'activity' || logType === 'catalog';

  return (
    <div className="space-y-6">
      {/* Non-repudiation: hash-chain verification */}
      <div className={`glass-card p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-4 ${verifyResult ? (verifyResult.verified ? 'border-emerald-500/30' : 'border-danger/40') : ''}`}>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Tamper-Evidence Verification</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recompute the audit hash chain to prove no records were altered.
          </p>
          {verifyResult && (
            <p className={`text-xs mt-1 ${verifyResult.verified ? 'text-emerald-400' : 'text-danger'}`}>
              {verifyResult.verified
                ? `Chain intact — ${verifyResult.verifiedCount}/${verifyResult.total} records verified at ${format(new Date(verifyResult.verifiedAt), 'PPpp')}.`
                : `${verifyResult.brokenCount} of ${verifyResult.total} record(s) failed verification.`}
            </p>
          )}
        </div>
        <button
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
          className="px-4 py-2 rounded-lg bg-surface-2 text-white text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {verifyMutation.isPending ? 'Verifying…' : 'Verify Integrity'}
        </button>
      </div>

      {verifyResult && !verifyResult.verified && (
        <div className="glass-card p-4 rounded-xl border border-danger/30 space-y-2">
          <p className="text-sm font-semibold text-danger">Broken records</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="py-1 px-2">Record ID</th>
                  <th className="py-1 px-2">Timestamp</th>
                  <th className="py-1 px-2">Link OK</th>
                  <th className="py-1 px-2">Hash OK</th>
                </tr>
              </thead>
              <tbody>
                {verifyResult.broken.map((b) => (
                  <tr key={b.id} className="border-b border-white/5">
                    <td className="py-1 px-2 font-mono text-gray-300">{b.id}</td>
                    <td className="py-1 px-2 text-gray-300">{format(new Date(b.created_at), 'MMM d, yyyy HH:mm')}</td>
                    <td className="py-1 px-2">{b.linkOk ? '✓' : '✗'}</td>
                    <td className="py-1 px-2">{b.hashOk ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{logType === 'catalog' ? 'Catalog Audit Log' : 'Audit Logs'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {logType === 'catalog' ? 'Review catalog metadata, pricing, and inventory changes.' : 'Review system activity and security events.'}
          </p>
        </div>
        {isActivity && (
          <div className="flex gap-2">
            <button onClick={() => {
              const p = new URLSearchParams(filters);
              p.set('format', 'csv');
              const endpoint = logType === 'catalog' ? '/admin/audit/catalog/export' : '/admin/audit/export';
              api.get(`${endpoint}?${p.toString()}`, { responseType: 'blob' }).then(({ data }) => {
                const url = URL.createObjectURL(new Blob([data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${logType}-export.${format(new Date(), 'yyyy-MM-dd')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              });
            }} className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Export CSV</button>
            <button onClick={() => {
              const p = new URLSearchParams(filters);
              p.set('format', 'pdf');
              const endpoint = logType === 'catalog' ? '/admin/audit/catalog/export' : '/admin/audit/export';
              api.get(`${endpoint}?${p.toString()}`, { responseType: 'blob' }).then(({ data }) => {
                const url = URL.createObjectURL(new Blob([data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${logType}-export.${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              });
            }} className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Export PDF</button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { id: 'activity', label: 'System Activity' },
          { id: 'catalog', label: 'Catalog Changes' },
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
            <label className="text-[11px] text-muted-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-nova-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-nova-500"
            />
          </div>
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
          <button onClick={() => { setQ(''); setSeverity(''); setActionType(''); setActor(''); setDateFrom(''); setDateTo(''); setPage(1); }} className="text-xs text-muted-foreground hover:text-white">Clear</button>
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-600 bg-[#111111] text-nova-500 focus:ring-nova-500"
              />
              Live
            </label>
          </div>
        </div>
      )}

      <div className="glass-card p-4 rounded-xl border space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `Showing ${startIdx}–${endIdx} of ${total} results` : 'No results'}
          </p>
        </div>
        <div className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">Loading logs...</div>
          ) : (
            <DataTable
              data={logs}
              columns={columns}
              pageSize={limit}
              disablePagination
              onRowClick={(row) => setSelectedLog(row)}
            />
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white disabled:opacity-50 hover:bg-white/10 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white disabled:opacity-50 hover:bg-white/10 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Transition show={!!selectedLog} as="div" className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Transition.Child
            as="div"
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          />
          <Transition.Child
            as="div"
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            className="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] p-6 text-left align-middle shadow-xl transition-all"
          >
            {selectedLog && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Audit Detail</h3>
                  <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-white">✕</button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Timestamp</p>
                      <p className="text-sm text-white">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Severity</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase mt-1 ${SEVERITY_BADGE[selectedLog.severity || 'info']}`}>{selectedLog.severity || 'info'}</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Action</p>
                      <p className="text-sm text-white font-medium">{selectedLog.action_label || selectedLog.action}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Action Type</p>
                      <p className="text-sm text-white">{selectedLog.action_type_label || selectedLog.action_type || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Entity</p>
                      <p className="text-sm text-white">{selectedLog.resourceType || selectedLog.entityType || '—'} {selectedLog.resource_label || selectedLog.entity_label ? `(${selectedLog.resource_label || selectedLog.entity_label})` : selectedLog.resourceId || selectedLog.entity_id ? `(${selectedLog.resourceId || selectedLog.entity_id})` : ''}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Actor</p>
                      <p className="text-sm text-white">{selectedLog.actor_full_name || 'System'} {selectedLog.actor_role && <span className="text-muted-foreground">({selectedLog.actor_role})</span>}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">IP Address</p>
                      <p className="text-sm text-white font-mono">{selectedLog.ipAddress || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">User Agent</p>
                      <p className="text-sm text-white break-all">{selectedLog.userAgent || '—'}</p>
                    </div>
                  </div>
                  {selectedLog.summary && (
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-sm text-gray-300">{selectedLog.summary}</p>
                    </div>
                  )}
                  {Array.isArray(selectedLog.delta) && selectedLog.delta.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Changes</p>
                      <div className="space-y-2">
                        {selectedLog.delta.map((d: AuditDeltaEntry, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 text-sm bg-[#111111] rounded-lg px-3 py-2">
                            <span className="text-gray-300 font-medium w-40 shrink-0">{d.label || d.field}</span>
                            <span className="text-red-400 line-through">{renderDeltaValue(d.before)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-emerald-400">{renderDeltaValue(d.after)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Details</p>
                      <pre className="text-xs text-gray-300 bg-[#111111] rounded-lg p-3 overflow-x-auto">{JSON.stringify(selectedLog.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </Transition.Child>
        </div>
      </Transition>
    </div>
  );
}
