import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { DataTable } from '@/shared/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ProductThreshold {
 id: string;
 name: string;
 sku: string;
 low_stock_threshold: number;
}

export default function Thresholds() {
 const [search, setSearch] = useState('');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editValue, setEditValue] = useState<number>(0);
 const qc = useQueryClient();

 const { data: response, isLoading } = useQuery({
 queryKey: ['inventory', 'thresholds', search],
 queryFn: async () => {
 const { data } = await api.get('/products', {
 params: { search, limit: 100 },
 });
 return data.data;
 },
 });

 const products = response?.products || [];

 const updateThresholdMutation = useMutation({
 mutationFn: async ({ id, threshold }: { id: string; threshold: number }) => {
 return api.put(`/inventory/${id}/threshold`, { lowStockThreshold: threshold });
 },
 onSuccess: () => {
 toast.success('Threshold updated');
 setEditingId(null);
 qc.invalidateQueries({ queryKey: ['inventory', 'thresholds'] });
 },
 onError: () => toast.error('Failed to update threshold'),
 });

 const handleSave = (id: string) => {
 updateThresholdMutation.mutate({ id, threshold: editValue });
 };

 const columns = useMemo<ColumnDef<ProductThreshold>[]>(() => [
 {
 accessorKey: 'name',
 header: 'Product Name',
 cell: (info) => (
 <div className="flex flex-col">
 <span className="font-medium text-white">{info.getValue() as string}</span>
 <span className="text-xs text-muted-foreground">{info.row.original.sku}</span>
 </div>
 ),
 },
 {
 accessorKey: 'low_stock_threshold',
 header: 'Warning Threshold',
 cell: (info) => {
 const id = info.row.original.id;
 const currentVal = info.getValue() as number;

 if (editingId === id) {
 return (
 <div className="flex items-center gap-2">
 <input
 type="number"
 min="0"
 value={editValue}
 onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
 className="w-20 bg-surface-2 border rounded px-2 py-1 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 autoFocus
 onKeyDown={(e) => {
 if (e.key === 'Enter') handleSave(id);
 if (e.key === 'Escape') setEditingId(null);
 }}
 />
 <button
 onClick={() => handleSave(id)}
 disabled={updateThresholdMutation.isPending}
 className="text-xs text-success font-medium hover:text-green-400"
 >
 Save
 </button>
 <button
 onClick={() => setEditingId(null)}
 className="text-xs text-muted-foreground hover:text-white"
 >
 Cancel
 </button>
 </div>
 );
 }

 return (
 <div className="flex items-center gap-4 group">
 <span className="font-medium text-white">{currentVal}</span>
 <button
 onClick={() => {
 setEditingId(id);
 setEditValue(currentVal);
 }}
 className="text-xs text-nova-500 opacity-0 group-hover:opacity-100 transition-opacity"
 >
 Edit
 </button>
 </div>
 );
 },
 },
 ], [editingId, editValue, updateThresholdMutation.isPending]);

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Stock Thresholds</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Configure when products trigger"Low Stock" warnings.
 </p>
 </div>
 </div>

 <div className="glass-card p-4 rounded-xl border space-y-4">
 <div className="flex gap-4">
 <div className="relative flex-1 max-w-sm">
 <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Search by name or SKU..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-surface-2 border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-colors"
 />
 </div>
 </div>

 <div className="h-[500px]">
 {isLoading ? (
 <div className="flex items-center justify-center h-full text-muted-foreground">
 Loading thresholds...
 </div>
 ) : (
 <DataTable data={products} columns={columns} pageSize={10} />
 )}
 </div>
 </div>
 </div>
 );
}