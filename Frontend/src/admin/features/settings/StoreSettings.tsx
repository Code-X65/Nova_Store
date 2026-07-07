import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { CogIcon } from '@heroicons/react/24/outline';

export default function StoreSettings() {
  const qc = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      return data.data; // array of { key, value }
    }
  });

  useEffect(() => {
    if (response) {
      const initialData: Record<string, string> = {};
      response.forEach((s: any) => {
        initialData[s.key] = s.value;
      });
      setFormData(initialData);
    }
  }, [response]);

  const saveMutation = useMutation({
    mutationFn: async (updates: { key: string, value: string }[]) => {
      return api.patch('/admin/settings/bulk', { settings: updates });
    },
    onSuccess: () => {
      toast.success('Settings updated');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => toast.error('Failed to update settings')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates = Object.entries(formData).map(([key, value]) => ({ key, value }));
    saveMutation.mutate(updates);
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-nova-500/20 rounded-lg">
          <CogIcon className="w-6 h-6 text-nova-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Store Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure global variables and store behavior.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 space-y-6">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">General</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Store Name</label>
              <input
                type="text"
                value={formData['store_name'] || ''}
                onChange={(e) => handleChange('store_name', e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Contact Email</label>
              <input
                type="email"
                value={formData['contact_email'] || ''}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Support Phone</label>
              <input
                type="text"
                value={formData['support_phone'] || ''}
                onChange={(e) => handleChange('support_phone', e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Currency</label>
              <select
                value={formData['currency'] || 'USD'}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-white/5 space-y-6">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Operations</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Low Stock Threshold</label>
              <input
                type="number"
                value={formData['low_stock_threshold'] || '10'}
                onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            <div className="space-y-2 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={formData['allow_backorders'] === 'true'}
                  onChange={(e) => handleChange('allow_backorders', e.target.checked ? 'true' : 'false')}
                  className="rounded border-white/10 bg-surface-2 text-nova-500 focus:ring-nova-500 focus:ring-offset-surface"
                />
                <span className="text-sm font-medium text-white">Allow Backorders</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}