import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';

const ENTITY_TYPES = [
  { value: 'product', label: 'Products', columns: 'sku, name, price, sale_price, cost_price, stock_quantity, category, description, status' },
  { value: 'category', label: 'Categories', columns: 'name, description' },
  { value: 'inventory', label: 'Inventory', columns: 'sku, warehouse_code, quantity, low_stock_threshold' },
  { value: 'variant', label: 'Variants', columns: 'product_sku, Size, Color, price_modifier, stock_quantity' },
];

export default function BulkImportPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState('product');
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const pollRef = useRef<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file as File);
      fd.append('entityType', entityType);
      const { data } = await api.post('/admin/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as { jobId: string; status: string };
    },
    onSuccess: (d) => {
      setJobId(d.jobId);
      toast.success('Upload accepted — processing started');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Upload failed'),
  });

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await api.get(`/admin/import/${jobId}`);
        if (!active) return;
        setJob(data.data.job);
        const s = data.data.job.status;
        if (s === 'completed' || s === 'failed' || s === 'partial') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          qc.invalidateQueries({ queryKey: ['products-list-minimal'] });
          qc.invalidateQueries({ queryKey: ['inventory', 'levels'] });
          toast.success(`Import ${s} (${data.data.job.processed_rows}/${data.data.job.total_rows} rows)`);
        }
      } catch {
        /* ignore transient */
      }
    };
    poll();
    pollRef.current = window.setInterval(poll, 1500);
    return () => {
      active = false;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [jobId, qc]);

  const selected = ENTITY_TYPES.find((e) => e.value === entityType)!;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Bulk Import (Excel)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a <code>.xlsx</code> / <code>.xls</code> workbook. The first sheet's columns are mapped to entity fields.
          Rejected rows are exported to a downloadable error sheet.
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
            >
              {ENTITY_TYPES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Workbook</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white file:mr-3 file:rounded file:border-0 file:bg-nova-500 file:px-3 file:py-1 file:text-sm"
            />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Expected columns for <span className="text-nova-400">{selected.label}</span>:{' '}
          <code>{selected.columns}</code>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
            className="btn-primary"
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Upload & Import'}
          </button>
        </div>
      </div>

      {job && (
        <div className="glass-card p-6 rounded-xl border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Job {jobId}</h2>
            <span className="text-sm text-nova-400 uppercase">{job.status}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Processed {job.processed_rows} / {job.total_rows} · {job.error_rows} rejected
          </div>
          {job.error_file_url && (
            <a href={job.error_file_url} className="btn-ghost inline-block" download>
              Download error sheet
            </a>
          )}
        </div>
      )}
    </div>
  );
}
