import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { CurrencyDollarIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface Currency {
 code: string;
 symbol: string;
 rate_to_base: number;
 is_active: boolean;
}

export default function CurrenciesPage() {
 const qc = useQueryClient();
 const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);

 const { data: currencies, isLoading } = useQuery({
 queryKey: ['currencies'],
 queryFn: async () => {
 const { data } = await api.get('/currencies');
 return data.data as Currency[];
 }
 });

 const updateMutation = useMutation({
 mutationFn: async (payload: { code: string; rate_to_base: number; is_active: boolean }) => {
 return api.put(`/currencies/admin/${payload.code}`, {
 rate_to_base: payload.rate_to_base,
 is_active: payload.is_active
 });
 },
 onSuccess: () => {
 toast.success('Currency updated');
 qc.invalidateQueries({ queryKey: ['currencies'] });
 setEditingCurrency(null);
 },
 onError: (err: any) => {
 toast.error(err?.response?.data?.message || 'Failed to update currency');
 }
 });

 if (isLoading) return <div className="p-8 text-muted-foreground">Loading currencies...</div>;

 return (
 <div className="w-full space-y-6 relative">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-nova-500/20 rounded-lg">
 <CurrencyDollarIcon className="w-6 h-6 text-nova-400" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-white">Currencies</h1>
 <p className="text-sm text-muted-foreground mt-1">Manage exchange rates relative to your base currency.</p>
 </div>
 </div>

 <div className="table-wrapper">
 <table className="table">
 <thead>
 <tr>
 <th>Code</th>
 <th>Symbol</th>
 <th>Exchange Rate</th>
 <th>Status</th>
 <th className="text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {currencies?.map((c) => (
 <tr key={c.code}>
 <td className="font-bold">{c.code}</td>
 <td>{c.symbol}</td>
 <td className="font-mono">{Number(c.rate_to_base).toFixed(4)}</td>
 <td>
 <span className={clsx('badge', c.is_active ? 'badge-success' : 'badge-muted')}>
 {c.is_active ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="text-right">
 <button
 onClick={() => setEditingCurrency(c)}
 className="p-2 text-muted-foreground hover:text-white rounded hover:bg-surface-2 transition-colors"
 >
 <PencilSquareIcon className="w-5 h-5" />
 </button>
 </td>
 </tr>
 ))}
 {(!currencies || currencies.length === 0) && (
 <tr>
 <td colSpan={5} className="text-center text-muted-foreground py-8">
 No currencies found.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>

 {/* Edit Modal */}
 {editingCurrency && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="glass-card w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
 <button
 onClick={() => setEditingCurrency(null)}
 className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
 >
 <XMarkIcon className="w-5 h-5" />
 </button>
 
 <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
 Edit {editingCurrency.code} <span className="text-muted-foreground font-normal text-base">({editingCurrency.symbol})</span>
 </h2>

 <form
 onSubmit={(e) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);
 updateMutation.mutate({
 code: editingCurrency.code,
 rate_to_base: Number(formData.get('rate_to_base')),
 is_active: formData.get('is_active') === 'on'
 });
 }}
 className="space-y-6"
 >
 <div className="space-y-2">
 <label className="label">Exchange Rate (vs Base)</label>
 <input
 type="number"
 step="0.0001"
 min="0.0001"
 name="rate_to_base"
 defaultValue={editingCurrency.rate_to_base}
 required
 className="input font-mono"
 />
 <p className="text-xs text-muted-foreground">E.g., if base is USD, 1 USD = {editingCurrency.rate_to_base} {editingCurrency.code}.</p>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 name="is_active"
 id="is_active"
 defaultChecked={editingCurrency.is_active}
 className="rounded bg-surface-2 text-nova-500 focus:ring-nova-500 focus:ring-offset-surface w-5 h-5"
 />
 <label htmlFor="is_active" className="text-sm font-medium text-white cursor-pointer select-none">
 Active (available at checkout)
 </label>
 </div>

 <div className="flex justify-end gap-4 pt-4 border-t">
 <button
 type="button"
 onClick={() => setEditingCurrency(null)}
 className="btn-ghost"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={updateMutation.isPending}
 className="btn-primary"
 >
 {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
