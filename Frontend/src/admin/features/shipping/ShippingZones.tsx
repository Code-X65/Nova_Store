import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function ShippingZones() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [countryInput, setCountryInput] = useState('');

  const { data: zonesData, isLoading } = useQuery({
    queryKey: ['admin-shipping-zones'],
    queryFn: async () => {
      const { data } = await api.get('/admin/shipping/zones');
      return data.data; // array
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return api.put(`/admin/shipping/zones/${editingId}`, { name, countries });
      } else {
        return api.post('/admin/shipping/zones', { name, countries });
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Zone updated' : 'Zone created');
      qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
      resetForm();
    },
    onError: () => toast.error('Failed to save zone')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/shipping/zones/${id}`);
    },
    onSuccess: () => {
      toast.success('Zone deleted');
      qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
    },
    onError: () => toast.error('Failed to delete zone')
  });

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCountries([]);
    setCountryInput('');
  };

  const handleEdit = (zone: any) => {
    setEditingId(zone.id);
    setName(zone.name);
    setCountries(zone.countries || []);
  };

  const addCountry = () => {
    if (countryInput.trim() && !countries.includes(countryInput.trim().toUpperCase())) {
      setCountries([...countries, countryInput.trim().toUpperCase()]);
      setCountryInput('');
    }
  };

  const removeCountry = (code: string) => {
    setCountries(countries.filter(c => c !== code));
  };

  const zones = Array.isArray(zonesData) ? zonesData : (zonesData?.zones || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shipping Zones</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure geographic zones for shipping rates.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              {zones.map((zone: any) => (
                <div key={zone.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{zone.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {zone.countries?.map((c: string) => (
                        <span key={c} className="px-2 py-0.5 text-xs font-medium bg-white/5 text-white rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(zone)} className="p-2 text-muted-foreground hover:text-white rounded hover:bg-white/10">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if(confirm('Delete?')) deleteMutation.mutate(zone.id); }} className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {zones.length === 0 && <p className="text-muted-foreground text-sm">No zones found.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 sticky top-24">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Zone' : 'Add Zone'}
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Zone Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                placeholder="e.g. North America"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Countries (2-letter ISO codes)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={2}
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addCountry(); } }}
                  className="flex-1 uppercase bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                  placeholder="US, CA..."
                />
                <button type="button" onClick={addCountry} className="px-3 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">Add</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {countries.map(c => (
                  <span key={c} className="px-2 py-1 text-xs font-medium bg-nova-500/10 text-nova-400 rounded flex items-center gap-1">
                    {c}
                    <button type="button" onClick={() => removeCountry(c)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-surface-2 border border-white/10 rounded-lg">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending || !name || countries.length === 0} className="flex-1 btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}