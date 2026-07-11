import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function CouponForm() {
 const { id } = useParams();
 const isEditing = Boolean(id);
 const navigate = useNavigate();
 const qc = useQueryClient();

 const [formData, setFormData] = useState({
 code: '',
 description: '',
 discount_type: 'percentage',
 discount_value: 0,
 minimum_purchase_amount: 0,
 max_uses: '',
 start_date: '',
 end_date: '',
 is_active: true,
 });

 const { data: couponData, isLoading } = useQuery({
 queryKey: ['admin-coupon', id],
 queryFn: async () => {
 const { data } = await api.get(`/admin/coupons/${id}`);
 return data.data;
 },
 enabled: isEditing,
 });

 useEffect(() => {
 if (couponData) {
 setFormData({
 code: couponData.code || '',
 description: couponData.description || '',
 discount_type: couponData.type || 'percentage',
 discount_value: couponData.value || 0,
 minimum_purchase_amount: couponData.min_order_amount || 0,
 max_uses: couponData.usage_limit || '',
 start_date: couponData.starts_at ? couponData.starts_at.split('T')[0] : '',
 end_date: couponData.expires_at ? couponData.expires_at.split('T')[0] : '',
 is_active: couponData.is_active,
 });
 }
 }, [couponData]);

 const saveMutation = useMutation({
 mutationFn: async (data: any) => {
 // transform empty strings back to null and map field names to Joi schema requirements
 const payload = {
 code: data.code,
 description: data.description,
 type: data.discount_type,
 value: data.discount_value,
 min_order_amount: data.minimum_purchase_amount,
 usage_limit: data.max_uses === '' ? null : parseInt(data.max_uses, 10),
 starts_at: data.start_date === '' ? null : new Date(data.start_date).toISOString(),
 expires_at: data.end_date === '' ? null : new Date(data.end_date).toISOString(),
 is_active: data.is_active,
 };
 
 if (isEditing) {
 return api.patch(`/admin/coupons/${id}`, payload);
 } else {
 return api.post('/admin/coupons', payload);
 }
 },
 onSuccess: () => {
 toast.success(isEditing ? 'Coupon updated' : 'Coupon created');
 qc.invalidateQueries({ queryKey: ['admin-coupons'] });
 navigate('/coupons');
 },
 onError: (err: any) => {
 toast.error(err.response?.data?.message || 'Failed to save coupon');
 }
 });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 saveMutation.mutate(formData);
 };

 if (isEditing && isLoading) return <div className="text-white">Loading...</div>;

 return (
 <div className="max-w-3xl space-y-8">
 <div>
 <h1 className="text-2xl font-bold text-white">{isEditing ? 'Edit Coupon' : 'Create Coupon'}</h1>
 <p className="text-sm text-muted-foreground mt-1">Define discount rules and limits.</p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="glass-card p-6 rounded-xl border space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Coupon Code *</label>
 <input
 type="text"
 required
 placeholder="e.g. SUMMER24"
 value={formData.code}
 onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
 className="w-full uppercase bg-surface-2 border rounded-lg px-4 py-2 text-white font-mono focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2 flex flex-col justify-end">
 <label className="flex items-center gap-2 cursor-pointer pt-3">
 <input
 type="checkbox"
 checked={formData.is_active}
 onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
 className="rounded bg-surface-2 text-nova-500 focus:ring-nova-500 focus:ring-offset-surface"
 />
 <span className="text-sm font-medium text-white">Active</span>
 </label>
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Description</label>
 <input
 type="text"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Discount Type</label>
 <select
 value={formData.discount_type}
 onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 >
 <option value="percentage">Percentage (%)</option>
 <option value="fixed">Fixed Amount ($)</option>
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
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Minimum Purchase Amount ($)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={formData.minimum_purchase_amount}
 onChange={(e) => setFormData({ ...formData, minimum_purchase_amount: parseFloat(e.target.value) || 0 })}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Maximum Uses</label>
 <input
 type="number"
 placeholder="Leave blank for unlimited"
 min="1"
 value={formData.max_uses}
 onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Start Date</label>
 <input
 type="date"
 value={formData.start_date}
 onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">End Date</label>
 <input
 type="date"
 value={formData.end_date}
 onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 </div>
 </div>
 </div>

 <div className="flex justify-end gap-4">
 <button
 type="button"
 onClick={() => navigate('/coupons')}
 className="px-4 py-2 text-sm font-medium text-white bg-surface-2 hover:bg-white/10 border rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saveMutation.isPending}
 className="btn-primary"
 >
 {isEditing ? 'Save Changes' : 'Create Coupon'}
 </button>
 </div>
 </form>
 </div>
 );
}