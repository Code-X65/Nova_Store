import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCatalogAuditLogs, exportCatalogAuditLogs } from './api/products';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { PermissionGuard } from '@/admin/components/guards/PermissionGuard';

const CHANGE_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'media', label: 'Media' },
  { value: 'status', label: 'Status' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'security', label: 'Security' },
];

const ENTITY_TYPES = [
  { value: '', label: 'All Entities' },
  { value: 'product', label: 'Products' },
  { value: 'category', label: 'Categories' },
  { value: 'brand', label: 'Brands' },
  { value: 'category_attribute', label: 'Attributes' },
  { value: 'product_variant', label: 'Variants' },
];

export default function TransactionHistory() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [changeCategory, setChangeCategory] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [q, setQ] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const limit = 20;

  const filters = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (entityType) p.set('entityType', entityType);
    if (changeCategory) p.set('changeCategory', changeCategory);
    if (fromDate) p.set('fromDate', fromDate);
    if (toDate) p.set('toDate', toDate);
    if (q) p.set('q', q);
    return p.toString();
  }, [page, entityType, changeCategory, fromDate, toDate, q]);

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ['catalog-audit', filters],
    queryFn: async () => {
      return fetchCatalogAuditLogs(filters);
    },
  });

  const logs = response?.logs || [];
  const total = response?.total || 0;
  const currentPage = response?.page || page;
  const pageLimit = response?.limit || limit;
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));

  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageLimit + 1;
  const endIdx = Math.min(currentPage * pageLimit, total);

  function renderDeltaValue(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string' && value.length > 60) return value.slice(0, 60) + '…';
    return String(value);
  }

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(row.original.created_at), 'MMM d, HH:mm:ss')}
        </span>
      ),
    },
    {
      accessorKey: 'change_category',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.original.change_category;
        const colors: Record<string, string> = {
          metadata: 'bg-gray-500/15 text-gray-300',
          pricing: 'bg-emerald-500/15 text-emerald-300',
          inventory: 'bg-sky-500/15 text-sky-300',
          media: 'bg-purple-500/15 text-purple-300',
          status: 'bg-amber-500/15 text-amber-300',
          configuration: 'bg-blue-500/15 text-blue-300',
          security: 'bg-red-500/15 text-red-300',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${colors[cat] || 'bg-muted text-muted-foreground'}`}>
            {cat || '—'}
          </span>
        );
      },
    },
    {
      header: 'Product / SKU',
      cell: ({ row }) => (
        <span className="text-sm text-gray-300">
          {row.original.resource_name || row.original.resource_label || '—'}
          {row.original.resource_sku && <span className="text-muted-foreground ml-1">({row.original.resource_sku})</span>}
        </span>
      ),
    },
    {
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-sm text-white font-medium max-w-md truncate" title={row.original.human_readable || row.original.action_label || row.original.summary || ''}>
          {row.original.human_readable || row.original.action_label || row.original.summary || '—'}
        </span>
      ),
    },
    {
      header: 'Actor',
      cell: ({ row }) => (
        <span className="text-xs text-gray-300">
          {row.original.actor_full_name || 'System'}
          {row.original.actor_role && <span className="text-muted-foreground ml-1">({row.original.actor_role})</span>}
        </span>
      ),
    },
    {
      header: 'Before → After',
      cell: ({ row }) => {
        const log = row.original;
        const hasDelta = Array.isArray(log.delta) && log.delta.length > 0;
        return (
          <div className="max-w-md">
            {hasDelta ? (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedLog(selectedLog?.id === log.id ? null : log); }}
                className="text-[11px] text-nova-400 hover:text-nova-300"
              >
                {selectedLog?.id === log.id ? 'Hide details' : `View ${log.delta!.length} change(s)`}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Notes',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-xs truncate" title={row.original.summary || ''}>
          {row.original.summary || '—'}
        </span>
      ),
    },
  ], [selectedLog]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catalog Transaction History</h1>
          <p className="text-sm text-muted-foreground mt-1">Full audit trail of catalog metadata and pricing changes.</p>
        </div>
        <PermissionGuard permission="audit:read">
          <button
            onClick={() => {
              const p = new URLSearchParams(filters);
              p.set('format', 'csv');
              exportCatalogAuditLogs(p.toString()).then((data) => {
                const url = URL.createObjectURL(new Blob([data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `catalog-audit-export.${format(new Date(), 'yyyy-MM-dd')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
            className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors"
          >
            Export CSV
          </button>
        </PermissionGuard>
      </div>

      <div className="flex flex-wrap gap-3 items-end glass-card p-4 rounded-xl border">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-nova-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-nova-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">Entity</label>
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white">
            {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">Category</label>
          <select value={changeCategory} onChange={(e) => { setChangeCategory(e.target.value); setPage(1); }} className="bg-[#111111] rounded-lg px-3 py-1.5 text-sm text-white">
            {CHANGE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
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
        <button
          onClick={() => { setFromDate(''); setToDate(''); setEntityType(''); setChangeCategory(''); setQ(''); setPage(1); }}
          className="text-xs text-muted-foreground hover:text-white"
        >
          Clear
        </button>
      </div>

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
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
            <div className="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] p-6 text-left align-middle shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Change Detail</h3>
                <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Timestamp</p>
                    <p className="text-sm text-white">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Action</p>
                    <p className="text-sm text-white font-medium">{selectedLog.action_label || selectedLog.action}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Entity</p>
                    <p className="text-sm text-white">{selectedLog.resourceType || '—'} {selectedLog.resource_name || selectedLog.resource_label ? `(${selectedLog.resource_name || selectedLog.resource_label})` : selectedLog.resourceId ? `(${selectedLog.resourceId})` : ''}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Actor</p>
                    <p className="text-sm text-white">{selectedLog.actor_full_name || 'System'} {selectedLog.actor_role && <span className="text-muted-foreground">({selectedLog.actor_role})</span>}</p>
                  </div>
                </div>
                {selectedLog.human_readable && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-gray-300">{selectedLog.human_readable}</p>
                  </div>
                )}
                {Array.isArray(selectedLog.delta) && selectedLog.delta.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Changes</p>
                    <div className="space-y-2">
                      {selectedLog.delta.map((d: any, idx: number) => (
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
