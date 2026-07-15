import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLocalizationSettings, fetchSeoSettings, uploadStoreImage, updateStoreImageField, updateStoreProfile, updateStoreOperations, updateSettingsGroup } from './api/store';
import toast from 'react-hot-toast';
import { CogIcon, PhotoIcon, GlobeAltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '@/admin/hooks/useAdminStore';

type Tab = 'general' | 'localization' | 'seo';

function clsx(...args: any[]) {
  return args.filter(Boolean).join(' ');
}

export default function StoreSettings() {
  const qc = useQueryClient();
  const { store, isLoading: storeLoading } = useAdminStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [opsForm, setOpsForm] = useState({ low_stock_threshold: '10', allow_backorders: 'false', 'payment.pay_on_delivery_enabled': 'false' });
  const [localizationForm, setLocalizationForm] = useState({ store_timezone: 'Africa/Lagos', date_format: 'dd/MM/yyyy' });
  const [seoForm, setSeoForm] = useState({ meta_title: '', meta_description: '', robots_txt: '', sitemap_enabled: true, json_ld_enabled: true });

  useEffect(() => {
    if (store) {
      setProfileForm({
        name: store.name || '',
        email: store.email || '',
        phone: store.phone || '',
        tagline: store.tagline || '',
        description: store.description || '',
        primary_color: store.primary_color || '#000000',
        secondary_color: store.secondary_color || '#ffffff',
        logo_url: store.logo_url || '',
        banner_url: store.banner_url || '',
        favicon_url: store.favicon_url || '',
        instagram: store.social_links?.instagram || '',
        twitter: store.social_links?.twitter || '',
        facebook: store.social_links?.facebook || '',
        tiktok: store.social_links?.tiktok || '',
        youtube: store.social_links?.youtube || '',
      });
      setOpsForm({
        low_stock_threshold: store.settings?.low_stock_threshold || '10',
        allow_backorders: store.settings?.allow_backorders || 'false',
        'payment.pay_on_delivery_enabled': store.settings?.['payment.pay_on_delivery_enabled'] || 'false'
      });
    }
  }, [store]);

  useEffect(() => {
    if (activeTab === 'localization') {
      fetchLocalizationSettings().then(setLocalizationForm).catch(() => {});
    } else if (activeTab === 'seo') {
      fetchSeoSettings().then(setSeoForm).catch(() => {});
    }
  }, [activeTab]);

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => uploadStoreImage(file)
  });

  const handleImageUpload = async (key: string, file: File) => {
    const toastId = toast.loading('Uploading image...');
    try {
      const url = await uploadImageMutation.mutateAsync(file);
      setProfileForm(prev => ({ ...prev, [key]: url }));
      await updateStoreImageField(key, url);
      qc.invalidateQueries({ queryKey: ['admin-store-profile'] });
      toast.success('Image uploaded', { id: toastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Upload failed', { id: toastId });
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => updateStoreProfile(updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-store-profile'] }); toast.success('Profile updated'); }
  });

  const updateOpsMutation = useMutation({
    mutationFn: async (updates: { key: string, value: string }[]) => updateStoreOperations(updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-store-profile'] }); toast.success('Operations updated'); }
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ group, data }: { group: string; data: Record<string, any> }) =>
      updateSettingsGroup(group, data),
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-settings', vars.group] });
      toast.success(`${vars.group === 'localization' ? 'Localization' : 'SEO'} settings saved`);
    }
  });

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileMutation.mutateAsync({
      name: profileForm.name, email: profileForm.email, phone: profileForm.phone,
      tagline: profileForm.tagline, description: profileForm.description,
      primary_color: profileForm.primary_color, secondary_color: profileForm.secondary_color,
      logo_url: profileForm.logo_url, banner_url: profileForm.banner_url, favicon_url: profileForm.favicon_url,
      social_links: { instagram: profileForm.instagram, twitter: profileForm.twitter, facebook: profileForm.facebook, tiktok: profileForm.tiktok, youtube: profileForm.youtube }
    });
  };

  const handleOpsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOpsMutation.mutateAsync([
      { key: 'low_stock_threshold', value: opsForm.low_stock_threshold },
      { key: 'allow_backorders', value: opsForm.allow_backorders },
      { key: 'payment.pay_on_delivery_enabled', value: opsForm['payment.pay_on_delivery_enabled'] || 'false' }
    ]);
  };

  const handleLocalizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateGroupMutation.mutateAsync({ group: 'localization', data: localizationForm });
  };

  const handleSeoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...seoForm,
      sitemap_enabled: seoForm.sitemap_enabled === true || seoForm.sitemap_enabled === 'true',
      json_ld_enabled: seoForm.json_ld_enabled === true || seoForm.json_ld_enabled === 'true',
    };
    await updateGroupMutation.mutateAsync({ group: 'seo', data: payload });
  };

  const set = (key: string, value: any) => setProfileForm(prev => ({ ...prev, [key]: value }));
  const setOps = (key: string, value: any) => setOpsForm(prev => ({ ...prev, [key]: value }));
  const setL10n = (key: string, value: any) => setLocalizationForm(prev => ({ ...prev, [key]: value }));
  const setSeo = (key: string, value: any) => setSeoForm(prev => ({ ...prev, [key]: value }));

  if (storeLoading) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: CogIcon },
    { id: 'localization', label: 'Localization', icon: GlobeAltIcon },
    { id: 'seo', label: 'SEO', icon: MagnifyingGlassIcon },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-nova-500/20 rounded-lg">
          <CogIcon className="w-6 h-6 text-nova-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Store Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure global variables and store behavior.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id ? 'border-nova-500 text-nova-400' : 'border-transparent text-gray-400 hover:text-white'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Store Name</label>
                <input type="text" value={profileForm.name || ''} onChange={e => set('name', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Contact Email</label>
                <input type="email" value={profileForm.email || ''} onChange={e => set('email', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Support Phone</label>
                <input type="text" value={profileForm.phone || ''} onChange={e => set('phone', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Currency</label>
                <div className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white">NGN (₦) — fixed for this single-vendor Nigerian store</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Low Stock Threshold</label>
                <input type="number" value={opsForm.low_stock_threshold} onChange={e => setOps('low_stock_threshold', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={opsForm.allow_backorders === 'true'} onChange={e => setOps('allow_backorders', e.target.checked ? 'true' : 'false')} className="rounded bg-surface-2 text-nova-500" />
                  <span className="text-sm font-medium text-white">Allow Backorders</span>
                </label>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">Payment & Fulfillment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={opsForm['payment.pay_on_delivery_enabled'] === 'true'} onChange={e => setOps('payment.pay_on_delivery_enabled', e.target.checked ? 'true' : 'false')} className="rounded bg-surface-2 text-nova-500" />
                  <span className="text-sm font-medium text-white">Enable Pay on Delivery</span>
                </label>
                <p className="text-xs text-gray-500">Allow customers to pay when their order is delivered.</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">Branding & Media</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Tagline</label>
                <input type="text" value={profileForm.tagline || ''} onChange={e => set('tagline', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-white">Description</label>
                <textarea value={profileForm.description || ''} onChange={e => set('description', e.target.value)} rows={3} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Primary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={profileForm.primary_color || '#000000'} onChange={e => set('primary_color', e.target.value)} className="w-10 h-10 rounded border bg-transparent cursor-pointer" />
                  <input type="text" value={profileForm.primary_color || '#000000'} onChange={e => set('primary_color', e.target.value)} className="flex-1 bg-surface-2 border rounded-lg px-4 py-2 text-white uppercase" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Secondary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={profileForm.secondary_color || '#ffffff'} onChange={e => set('secondary_color', e.target.value)} className="w-10 h-10 rounded border bg-transparent cursor-pointer" />
                  <input type="text" value={profileForm.secondary_color || '#ffffff'} onChange={e => set('secondary_color', e.target.value)} className="flex-1 bg-surface-2 border rounded-lg px-4 py-2 text-white uppercase" />
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t">
                {[
                  { key: 'logo_url', label: 'Store Logo', aspect: 'aspect-square w-32 h-32' },
                  { key: 'favicon_url', label: 'Favicon', aspect: 'aspect-square w-16 h-16' },
                  { key: 'banner_url', label: 'Store Banner', aspect: 'aspect-video w-full h-40 md:col-span-2' }
                ].map((media) => (
                  <div key={media.key} className={`space-y-2 ${media.aspect.includes('col-span-2') ? 'md:col-span-2' : ''}`}>
                    <label className="text-sm font-medium text-white">{media.label}</label>
                    <div className={`relative flex items-center justify-center bg-surface-2 rounded-xl border-2 border-dashed hover:border-nova-500/50 transition-colors overflow-hidden ${media.aspect.replace('md:col-span-2', '')}`}>
                      {profileForm[media.key] ? (
                        <img src={profileForm[media.key]} alt={media.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <PhotoIcon className="w-8 h-8 mb-2" />
                          <span className="text-xs">Upload {media.label}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-sm font-medium px-4 py-2 bg-black/50 rounded-lg shadow-lg">
                          {profileForm[media.key] ? 'Change Image' : 'Select Image'}
                        </span>
                      </div>
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) handleImageUpload(media.key, e.target.files[0]); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">Social Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['instagram', 'twitter', 'facebook', 'tiktok', 'youtube'].map((social) => (
                <div key={social} className="space-y-2">
                  <label className="text-sm font-medium text-white capitalize">{social}</label>
                  <input type="url" value={profileForm[social] || ''} onChange={e => set(social, e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button type="submit" disabled={updateProfileMutation.isPending} className="btn-primary">
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'localization' && (
        <form onSubmit={handleLocalizationSubmit} className="space-y-6">
          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">Localization</h2>
            <p className="text-xs text-gray-400">Operational settings only. No i18n or multilingual support.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Store Timezone</label>
                <input type="text" value={localizationForm.store_timezone || ''} onChange={e => setL10n('store_timezone', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" placeholder="e.g. Africa/Lagos" />
                <p className="text-xs text-gray-500">IANA timezone database name. Drives reporting and order timestamps.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Date Format</label>
                <select value={localizationForm.date_format || 'dd/MM/yyyy'} onChange={e => setL10n('date_format', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white">
                  <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                  <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                  <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button type="submit" disabled={updateGroupMutation.isPending} className="btn-primary">
              {updateGroupMutation.isPending ? 'Saving...' : 'Save Localization'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'seo' && (
        <form onSubmit={handleSeoSubmit} className="space-y-6">
          <div className="glass-card p-6 rounded-xl border space-y-6">
            <h2 className="text-lg font-semibold text-white border-b pb-2">SEO & Metadata</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Meta Title</label>
                <input type="text" maxLength={60} value={seoForm.meta_title || ''} onChange={e => setSeo('meta_title', e.target.value)} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
                <p className="text-xs text-gray-500">{(seoForm.meta_title || '').length}/60 characters</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Meta Description</label>
                <textarea value={seoForm.meta_description || ''} onChange={e => setSeo('meta_description', e.target.value)} rows={3} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white" />
                <p className="text-xs text-gray-500">{(seoForm.meta_description || '').length}/160 characters</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">robots.txt</label>
                <textarea value={seoForm.robots_txt || ''} onChange={e => setSeo('robots_txt', e.target.value)} rows={4} className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white font-mono text-xs" />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={seoForm.sitemap_enabled === true || seoForm.sitemap_enabled === 'true'} onChange={e => setSeo('sitemap_enabled', e.target.checked)} className="rounded bg-surface-2 text-nova-500" />
                  <span className="text-sm font-medium text-white">Enable Sitemap</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={seoForm.json_ld_enabled === true || seoForm.json_ld_enabled === 'true'} onChange={e => setSeo('json_ld_enabled', e.target.checked)} className="rounded bg-surface-2 text-nova-500" />
                  <span className="text-sm font-medium text-white">Enable JSON-LD</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button type="submit" disabled={updateGroupMutation.isPending} className="btn-primary">
              {updateGroupMutation.isPending ? 'Saving...' : 'Save SEO'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
