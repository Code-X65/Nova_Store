import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

interface AlertConfig {
  id?: string;
  product_id: string | null;
  threshold: number;
  notify_emails: string[];
  enabled: boolean;
}

interface ProductLite {
  id: string;
  name: string;
  sku: string;
}

export default function AlertsPage() {
  const qc = useQueryClient();

  const [emails, setEmails] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(5);
  const [productId, setProductId] = useState<string>('');
  const [enabled, setEnabled] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string>('');

  const { data: alertsData = [], isLoading } = useQuery({
    queryKey: ['inventory', 'alerts'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/alerts');
      return data.data as AlertConfig[];
    }
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-list-minimal'],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { limit: 500 } });
      return data.data.products as ProductLite[] || [];
    }
  });

  const productNameMap = useMemo(() => {
    const map = new Map<string, string>();
    productsData?.forEach(p => map.set(p.id, `${p.name} (${p.sku})`));
    return map;
  }, [productsData]);

  const saveMutation = useMutation({
    mutationFn: async (body: { id?: string; productId?: string; threshold: number; notifyEmails: string[]; enabled: boolean }) => {
      if (body.id) {
        return api.put(`/inventory/alerts/${body.id}`, body);
      }
      return api.post('/inventory/alerts', body);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Alert updated' : 'Alert configuration saved');
      resetForm();
      qc.invalidateQueries({ queryKey: ['inventory', 'alerts'] });
    },
    onError: () => toast.error('Failed to save alert configuration')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/inventory/alerts/${id}`),
    onSuccess: () => {
      toast.success('Alert deleted');
      qc.invalidateQueries({ queryKey: ['inventory', 'alerts'] });
    },
    onError: () => toast.error('Failed to delete alert')
  });

  const resetForm = () => {
    setEmails('');
    setProductId('');
    setThreshold(5);
    setEnabled(true);
    setEditingId(null);
    setEditingProductId('');
  };

  const handleEdit = (alert: AlertConfig) => {
    setEditingId(alert.id || null);
    setThreshold(alert.threshold);
    setEnabled(alert.enabled);
    setEmails((alert.notify_emails || []).join(', '));
    setProductId(alert.product_id || '');
    setEditingProductId(alert.product_id || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this alert configuration?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = () => {
    if (threshold < 1) {
      toast.error('Threshold must be at least 1');
      return;
    }
    saveMutation.mutate({
      id: editingId || undefined,
      productId: productId || null,
      threshold,
      notifyEmails: emails.split(',').map(e => e.trim()).filter(Boolean),
      enabled
    });
  };

  const globalAlerts = alertsData.filter(a => !a.product_id);
  const specificAlerts = alertsData.filter(a => a.product_id);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Email Alert Configurations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure who receives email notifications when stock levels fall below thresholds.
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl border">
        <h2 className="text-lg font-semibold text-white mb-4">
          {editingId ? 'Edit Configuration' : 'Add New Configuration'}
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Target Product (Optional)</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              >
                <option value="">Global (All Products)</option>
                {productsData?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Leave empty to set a global alert rule.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Threshold</label>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Notification Emails</label>
            <input
              type="text"
              placeholder="admin@store.com, manager@store.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of email addresses. Optional for threshold-only alerts.</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded bg-surface-2 text-nova-500 focus:ring-nova-500"
            />
            <label htmlFor="enabled" className="text-sm text-white">Active</label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            {editingId && (
              <button onClick={resetForm} className="btn-ghost">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="btn-primary"
            >
              {saveMutation.isPending ? 'Saving...' : (editingId ? 'Update Configuration' : 'Save Configuration')}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Existing Configurations</h2>

        {isLoading ? (
          <p className="text-muted-foreground">Loading configurations...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {globalAlerts.map(alert => (
              <div key={alert.id} className="glass-card p-5 border rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-nova-400">Global Alert</h3>
                  <div className="flex items-center gap-2">
                    <span className={alert.enabled ? 'text-success text-xs' : 'text-danger text-xs'}>
                      {alert.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Threshold: {alert.threshold}
                </p>
                <div className="pt-2">
                  <p className="text-xs text-white mb-1">Emails:</p>
                  <div className="flex flex-wrap gap-1">
                    {(alert.notify_emails?.length ?? 0) > 0
                      ? alert.notify_emails!.map((e, i) => (
                        <span key={i} className="px-2 py-0.5 bg-surface-2 rounded text-xs text-muted-foreground">{e}</span>
                      ))
                      : <span className="text-xs text-muted-foreground">No emails configured</span>
                    }
                  </div>
                </div>
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => handleEdit(alert)}
                    className="text-xs text-nova-400 hover:text-nova-300 flex items-center gap-1"
                  >
                    <PencilIcon className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id!)}
                    className="text-xs text-danger hover:text-red-400 flex items-center gap-1"
                  >
                    <TrashIcon className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}

            {specificAlerts.map(alert => (
              <div key={alert.id} className="glass-card p-5 border rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-white">Product Specific</h3>
                  <div className="flex items-center gap-2">
                    <span className={alert.enabled ? 'text-success text-xs' : 'text-danger text-xs'}>
                      {alert.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {alert.product_id ? (productNameMap.get(alert.product_id) || `Product ID: ${alert.product_id}`) : 'Global'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Threshold: {alert.threshold}
                </p>
                <div className="pt-2">
                  <p className="text-xs text-white mb-1">Emails:</p>
                  <div className="flex flex-wrap gap-1">
                    {(alert.notify_emails?.length ?? 0) > 0
                      ? alert.notify_emails!.map((e, i) => (
                        <span key={i} className="px-2 py-0.5 bg-surface-2 rounded text-xs text-muted-foreground">{e}</span>
                      ))
                      : <span className="text-xs text-muted-foreground">No emails configured</span>
                    }
                  </div>
                </div>
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => handleEdit(alert)}
                    className="text-xs text-nova-400 hover:text-nova-300 flex items-center gap-1"
                  >
                    <PencilIcon className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id!)}
                    className="text-xs text-danger hover:text-red-400 flex items-center gap-1"
                  >
                    <TrashIcon className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}

            {alertsData.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2">No active alert configurations.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
