import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function ShippingRates() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    zone_id: '',
    name: '',
    rate_type: 'flat_rate',
    base_price: 0,
    min_order_value: 0,
    max_order_value: '',
  });

  const { data: zonesData } = useQuery({
    queryKey: ['admin-shipping-zones'],
    queryFn: async () => {
      const { data } = await api.get('/admin/shipping/zones');
      return data.data; // array
    }
  });

  const { data: ratesData, isLoading } = useQuery({
    queryKey: ['admin-shipping-rates'],
    queryFn: async () => {
      const { data } = await api.get('/admin/shipping/rates');
      return data.data; // array
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        max_order_value: formData.max_order_value === '' ? null : formData.max_order_value
      };
      if (editingId) {
        return api.put(`/admin/shipping/rates/${editingId}`, payload);
      } else {
        return api.post('/admin/shipping/rates', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Rate updated' : 'Rate created');
      qc.invalidateQueries({ queryKey: ['admin-shipping-rates'] });
      resetForm();
    },
    onError: () => toast.error('Failed to save rate')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/shipping/rates/${id}`);
    },
    onSuccess: () => {
      toast.success('Rate deleted');
      qc.invalidateQueries({ queryKey: ['admin-shipping-rates'] });
    },
    onError: () => toast.error('Failed to delete rate')
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      zone_id: '',
      name: '',
      rate_type: 'flat_rate',
      base_price: 0,
      min_order_value: 0,
      max_order_value: '',
    });
  };

  const handleEdit = (rate: any) => {
    setEditingId(rate.id);
    setFormData({
      zone_id: rate.zone_id,
      name: rate.name,
      rate_type: rate.rate_type || 'flat_rate',
      base_price: rate.base_price,
      min_order_value: rate.min_order_value || 0,
      max_order_value: rate.max_order_value || '',
    });
  };

  const zones = Array.isArray(zonesData) ? zonesData : (zonesData?.zones || []);
  const rates = Array.isArray(ratesData) ? ratesData : (ratesData?.rates || []);

  const getZoneName = (zoneId: string) => {
    return zones.find((z: any) => z.id === zoneId)?.name || 'Unknown Zone';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shipping Rates</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure pricing for shipping methods.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              {rates.map((rate: any) => (
                <div key={rate.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{rate.name}</h3>
                    <p className="text-sm text-nova-400 font-medium">${Number(rate.base_price).toFixed(2)}</p>
                    <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                      <span>Zone: {getZoneName(rate.zone_id)}</span>
                      <span>Min Order: ${Number(rate.min_order_value || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(rate)} className="p-2 text-muted-foreground hover:text-white rounded hover:bg-white/10">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if(confirm('Delete?')) deleteMutation.mutate(rate.id); }} className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {rates.length === 0 && <p className="text-muted-foreground text-sm">No rates configured.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 sticky top-24">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Rate' : 'Add Rate'}
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Zone</label>
              <select
                required
                value={formData.zone_id}
                onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              >
                <option value="">Select Zone...</option>
                {zones.map((z: any) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Rate Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                placeholder="e.g. Standard Shipping"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Min Order ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.min_order_value}
                  onChange={(e) => setFormData({ ...formData, min_order_value: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-surface-2 border border-white/10 rounded-lg">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending || !formData.name || !formData.zone_id} className="flex-1 btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}