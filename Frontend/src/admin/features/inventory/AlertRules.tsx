import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAlertRules, fetchWarehousesMinimal, saveAlertRule, deleteAlertRule, type AlertRule as Rule } from './api/alertRules';
import { fetchProductsMinimal } from './api/inventory';
import toast from 'react-hot-toast';

export default function AlertRulesPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<'product' | 'variant' | 'warehouse' | 'global'>('product');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [threshold, setThreshold] = useState(10);
  const [channels, setChannels] = useState<string[]>(['in_app', 'email']);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['stock-alert-rules'],
    queryFn: fetchAlertRules,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list-minimal'],
    queryFn: async () => fetchProductsMinimal({ limit: 500 }),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehousesMinimal,
  });

  const productNameMap = useMemo(() => new Map((products as any[]).map((p) => [p.id, `${p.name} (${p.sku})`])), [products]);

  const saveMutation = useMutation({
    mutationFn: async (body: any) => saveAlertRule(body),
    onSuccess: () => {
      toast.success(editingId ? 'Rule updated' : 'Rule created');
      reset();
      qc.invalidateQueries({ queryKey: ['stock-alert-rules'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to save rule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlertRule(id),
    onSuccess: () => {
      toast.success('Rule deleted');
      qc.invalidateQueries({ queryKey: ['stock-alert-rules'] });
    },
    onError: () => toast.error('Failed to delete rule'),
  });

  const reset = () => {
    setScope('product'); setProductId(''); setWarehouseId(''); setThreshold(10);
    setChannels(['in_app', 'email']); setEditingId(null);
  };

  const handleEdit = (r: Rule) => {
    setEditingId(r.id || null);
    setScope(r.scope);
    setProductId(r.product_id || '');
    setWarehouseId(r.warehouse_id || '');
    setThreshold(r.threshold);
    setChannels(r.channels || ['in_app', 'email']);
  };

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSubmit = () => {
    if (threshold < 0) return toast.error('Threshold must be ≥ 0');
    saveMutation.mutate({
      id: editingId || undefined,
      scope,
      productId: scope === 'product' ? productId || null : null,
      variantId: null,
      warehouseId: scope === 'warehouse' ? warehouseId || null : null,
      threshold,
      channels,
      recipientRole: null,
      isActive: true,
    });
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Stock Alert Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define thresholds that trigger low-stock alerts (in-app + email) when available stock drops at/below the limit.
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl border space-y-4">
        <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit Rule' : 'Add Rule'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-white">Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white">
              <option value="global">Global (all products)</option>
              <option value="product">Per product</option>
              <option value="warehouse">Per warehouse</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-white">Threshold</label>
            <input type="number" min={0} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
          </div>
          {scope === 'product' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-white">Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white">
                <option value="">Select…</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
          )}
          {scope === 'warehouse' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-white">Warehouse</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white">
                <option value="">Select…</option>
                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {['in_app', 'email'].map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChannel(c)} className="rounded bg-surface-2 text-nova-500" />
              {c}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          {editingId && <button onClick={reset} className="btn-ghost">Cancel</button>}
          <button onClick={handleSubmit} disabled={saveMutation.isPending} className="btn-primary">{editingId ? 'Update' : 'Create'} Rule</button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Rules</h2>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {rules.map((r) => (
              <div key={r.id} className="glass-card p-5 border rounded-xl space-y-2">
                <div className="flex justify-between">
                  <h3 className="font-semibold text-white capitalize">{r.scope}</h3>
                  <span className="text-xs text-nova-400">{r.channels.join(', ')}</span>
                </div>
                <p className="text-sm text-muted-foreground">Threshold: {r.threshold}</p>
                {r.product_id && <p className="text-xs text-muted-foreground">{productNameMap.get(r.product_id) || r.product_id}</p>}
                <div className="pt-2 flex gap-3">
                  <button onClick={() => handleEdit(r)} className="text-xs text-nova-400 hover:text-nova-300">Edit</button>
                  <button onClick={() => deleteMutation.mutate(r.id!)} className="text-xs text-danger hover:text-red-400">Delete</button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="text-sm text-muted-foreground">No alert rules yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
