import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { CogIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '@/admin/hooks/useAdminStore';

export default function StoreSettings() {
 const qc = useQueryClient();
 const { store, isLoading } = useAdminStore();
 const [formData, setFormData] = useState<Record<string, string>>({});

 useEffect(() => {
 if (store) {
 setFormData({
 name: store.name || '',
 email: store.email || '',
 phone: store.phone || '',
 currency: store.currency || 'USD',
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
 // Fallback for settings if they exist
 low_stock_threshold: store.settings?.low_stock_threshold || '10',
 allow_backorders: store.settings?.allow_backorders || 'false',
 });
 }
 }, [store]);

 const uploadImageMutation = useMutation({
 mutationFn: async (file: File) => {
 const payload = new FormData();
 payload.append('file', file);
 const res = await api.post('/admin/upload', payload, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 return res.data.data.url;
 }
 });

 const handleImageUpload = async (key: string, file: File) => {
 const toastId = toast.loading('Uploading image...');
 try {
 const url = await uploadImageMutation.mutateAsync(file);
 handleChange(key, url);
 
 // Auto-save the image to the backend so it persists immediately
 await updateProfileMutation.mutateAsync({ [key]: url });
 qc.invalidateQueries({ queryKey: ['admin-store-profile'] });

 toast.success('Image uploaded successfully', { id: toastId });
 } catch (error: any) {
 toast.error(error?.response?.data?.error || 'Failed to upload image', { id: toastId });
 }
 };

 const updateProfileMutation = useMutation({
 mutationFn: async (updates: Record<string, string>) => {
 return api.put('/admin/store', updates);
 }
 });

 const updateSettingsMutation = useMutation({
 mutationFn: async (updates: { key: string, value: string }[]) => {
 return api.patch('/admin/store/settings', { settings: updates });
 }
 });

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 const profileUpdates = {
 name: formData.name,
 email: formData.email,
 phone: formData.phone,
 currency: formData.currency,
 tagline: formData.tagline,
 description: formData.description,
 primary_color: formData.primary_color,
 secondary_color: formData.secondary_color,
 logo_url: formData.logo_url,
 banner_url: formData.banner_url,
 favicon_url: formData.favicon_url,
 social_links: {
 instagram: formData.instagram,
 twitter: formData.twitter,
 facebook: formData.facebook,
 tiktok: formData.tiktok,
 youtube: formData.youtube
 }
 };

 const settingsUpdates = [
 { key: 'low_stock_threshold', value: formData.low_stock_threshold },
 { key: 'allow_backorders', value: formData.allow_backorders }
 ];

 try {
 await Promise.all([
 updateProfileMutation.mutateAsync(profileUpdates),
 updateSettingsMutation.mutateAsync(settingsUpdates)
 ]);
 toast.success('Store settings updated successfully');
 qc.invalidateQueries({ queryKey: ['admin-store-profile'] });
 } catch (error) {
 toast.error('Failed to update store settings');
 }
 };

 const handleChange = (key: string, value: string) => {
 setFormData(prev => ({ ...prev, [key]: value }));
 };

 if (isLoading) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

 const isPending = updateProfileMutation.isPending || updateSettingsMutation.isPending || uploadImageMutation.isPending;

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
 <div className="glass-card p-6 rounded-xl border space-y-6">
 <h2 className="text-lg font-semibold text-white border-b pb-2">General</h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Store Name</label>
 <input
 type="text"
 value={formData['name'] || ''}
 onChange={(e) => handleChange('name', e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Contact Email</label>
 <input
 type="email"
 value={formData['email'] || ''}
 onChange={(e) => handleChange('email', e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Support Phone</label>
 <input
 type="text"
 value={formData['phone'] || ''}
 onChange={(e) => handleChange('phone', e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Currency</label>
 <select
 value={formData['currency'] || 'USD'}
 onChange={(e) => handleChange('currency', e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 >
 <option value="NGN">NGN (₦)</option>
 <option value="USD">USD ($)</option>
 <option value="EUR">EUR (€)</option>
 <option value="GBP">GBP (£)</option>
 </select>
 </div>
 </div>
 </div>

 <div className="glass-card p-6 rounded-xl border space-y-6">
 <h2 className="text-lg font-semibold text-white border-b pb-2">Operations</h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Low Stock Threshold</label>
 <input
 type="number"
 value={formData['low_stock_threshold'] || '10'}
 onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2 flex flex-col justify-end">
 <label className="flex items-center gap-2 cursor-pointer pb-2">
 <input
 type="checkbox"
 checked={formData['allow_backorders'] === 'true'}
 onChange={(e) => handleChange('allow_backorders', e.target.checked ? 'true' : 'false')}
 className="rounded bg-surface-2 text-nova-500 focus:ring-nova-500 focus:ring-offset-surface"
 />
 <span className="text-sm font-medium text-white">Allow Backorders</span>
 </label>
 </div>
 </div>
 </div>

 <div className="glass-card p-6 rounded-xl border space-y-6">
 <h2 className="text-lg font-semibold text-white border-b pb-2">Branding & Media</h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Tagline</label>
 <input
 type="text"
 value={formData['tagline'] || ''}
 onChange={(e) => handleChange('tagline', e.target.value)}
 placeholder="Shop smarter, not harder"
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <label className="text-sm font-medium text-white">Description</label>
 <textarea
 value={formData['description'] || ''}
 onChange={(e) => handleChange('description', e.target.value)}
 rows={3}
 placeholder="Tell customers about your store..."
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Primary Color</label>
 <div className="flex gap-2">
 <input
 type="color"
 value={formData['primary_color'] || '#000000'}
 onChange={(e) => handleChange('primary_color', e.target.value)}
 className="w-10 h-10 rounded border bg-transparent cursor-pointer"
 />
 <input
 type="text"
 value={formData['primary_color'] || '#000000'}
 onChange={(e) => handleChange('primary_color', e.target.value)}
 className="flex-1 bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 uppercase"
 />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Secondary Color</label>
 <div className="flex gap-2">
 <input
 type="color"
 value={formData['secondary_color'] || '#ffffff'}
 onChange={(e) => handleChange('secondary_color', e.target.value)}
 className="w-10 h-10 rounded border bg-transparent cursor-pointer"
 />
 <input
 type="text"
 value={formData['secondary_color'] || '#ffffff'}
 onChange={(e) => handleChange('secondary_color', e.target.value)}
 className="flex-1 bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 uppercase"
 />
 </div>
 </div>

 {/* Media Uploads */}
 <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t">
 {[
 { key: 'logo_url', label: 'Store Logo', aspect: 'aspect-square w-32 h-32' },
 { key: 'favicon_url', label: 'Favicon', aspect: 'aspect-square w-16 h-16' },
 { key: 'banner_url', label: 'Store Banner', aspect: 'aspect-video w-full h-40 md:col-span-2' }
 ].map((media) => (
 <div key={media.key} className={`space-y-2 ${media.aspect.includes('col-span-2') ? 'md:col-span-2' : ''}`}>
 <label className="text-sm font-medium text-white">{media.label}</label>
 <div className={`relative flex items-center justify-center bg-surface-2 rounded-xl border-2 border-dashed hover:border-nova-500/50 transition-colors overflow-hidden ${media.aspect.replace('md:col-span-2', '')}`}>
 {formData[media.key] ? (
 <img src={formData[media.key]} alt={media.label} className="w-full h-full object-cover" />
 ) : (
 <div className="flex flex-col items-center text-muted-foreground">
 <PhotoIcon className="w-8 h-8 mb-2" />
 <span className="text-xs">Upload {media.label}</span>
 </div>
 )}
 
 {/* Hover overlay for changing image */}
 <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
 <span className="text-white text-sm font-medium px-4 py-2 bg-black/50 rounded-lg shadow-lg">
 {formData[media.key] ? 'Change Image' : 'Select Image'}
 </span>
 </div>

 <input
 type="file"
 accept="image/*"
 onChange={(e) => {
 if (e.target.files?.[0]) handleImageUpload(media.key, e.target.files[0]);
 }}
 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
 title=""
 />
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
 <input
 type="url"
 value={formData[social] || ''}
 onChange={(e) => handleChange(social, e.target.value)}
 placeholder={`https://${social}.com/yourstore`}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 ))}
 </div>
 </div>

 <div className="flex justify-end gap-4">
 <button
 type="submit"
 disabled={isPending}
 className="btn-primary"
 >
 {isPending ? 'Saving...' : 'Save Changes'}
 </button>
 </div>
 </form>
 </div>
 );
}