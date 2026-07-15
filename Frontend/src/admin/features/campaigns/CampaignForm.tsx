import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchCampaign, createCampaign, updateCampaign } from './api/campaigns';

export default function CampaignForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    scope: 'all_products' as 'all_products' | 'category' | 'brand' | 'products',
    starts_at: '',
    ends_at: '',
    is_active: true,
  });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['admin-campaign', id],
    queryFn: () => fetchCampaign(id as string),
    enabled: isEditing,
  });

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        discount_type: campaign.discount_type,
        discount_value: campaign.discount_value,
        scope: campaign.scope,
        starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
        ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
        is_active: campaign.is_active,
      });
    }
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...formData,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : undefined,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : undefined,
      };
      return isEditing ? updateCampaign(id as string, payload) : createCampaign(payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Campaign updated' : 'Campaign created');
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
      navigate('/campaigns');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to save campaign'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  if (isEditing && isLoading) return <div className="text-white">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{isEditing ? 'Edit Campaign' : 'Create Campaign'}</h1>
        <p className="text-sm text-gray-400 mt-1">Define a time-boxed discount and what it applies to.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-black rounded-xl p-6 border border-white/10 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Campaign Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Discount Type</label>
              <select
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₦)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Discount Value *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Applies To</label>
            <select
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value as typeof formData.scope })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
            >
              <option value="all_products">All Products</option>
              <option value="category">Specific Category</option>
              <option value="brand">Specific Brand</option>
              <option value="products">Specific Products</option>
            </select>
            <p className="text-xs text-gray-500">Category/brand/product targeting is configured after creation via the API; this MVP form scopes to all products by default.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Starts At *</label>
              <input
                type="datetime-local"
                required
                value={formData.starts_at}
                onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Ends At *</label>
              <input
                type="datetime-local"
                required
                value={formData.ends_at}
                onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded bg-white/5 text-nova-500 focus:ring-nova-500"
            />
            <span className="text-sm font-medium text-white">Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate('/campaigns')} className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saveMutation.isPending || !formData.name.trim() || formData.discount_value <= 0} className="btn-primary">
            {isEditing ? 'Save Changes' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
