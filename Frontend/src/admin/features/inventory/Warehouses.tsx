import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWarehouses, fetchWarehouseStock, createWarehouse, transferStock } from './api/warehouses';
import { fetchProductsMinimal } from './api/inventory';
import toast from 'react-hot-toast';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<any>();

const stockColumns = [
  columnHelper.accessor((l) => l.products?.name || l.product_variants?.sku || '—', {
    id: 'product',
    header: 'Product',
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor((l) => l.products?.sku || l.product_variants?.sku || '—', {
    id: 'sku',
    header: 'SKU',
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor('quantity', {
    header: 'Qty',
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor('reserved', {
    header: 'Reserved',
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor((l) => l.quantity - l.reserved, {
    id: 'available',
    header: 'Available',
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor('low_stock_threshold', {
    header: 'Threshold',
    cell: (info) => <span>{info.getValue()}</span>,
  }),
];

export default function WarehousesPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [activeWh, setActiveWh] = useState('');
  const [transfer, setTransfer] = useState({ productId: '', toWarehouseId: '', quantity: 1 });

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['inventory', 'levels', activeWh],
    enabled: !!activeWh,
    queryFn: async () => fetchWarehouseStock(activeWh),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list-minimal'],
    queryFn: async () => fetchProductsMinimal({ limit: 500 }),
  });

  const createMutation = useMutation({
    mutationFn: async () => createWarehouse({ code, name, location: location || null }),
    onSuccess: () => {
      toast.success('Warehouse created');
      setCode(''); setName(''); setLocation('');
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to create warehouse'),
  });

  const transferMutation = useMutation({
    mutationFn: async () => transferStock({
      productId: transfer.productId || null,
      fromWarehouseId: activeWh,
      toWarehouseId: transfer.toWarehouseId,
      quantity: Number(transfer.quantity),
    }),
    onSuccess: () => {
      toast.success('Stock transferred');
      qc.invalidateQueries({ queryKey: ['inventory', 'levels', activeWh] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Transfer failed'),
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Warehouses & Multi-Location Stock</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage storage locations and transfer stock between them.</p>
      </div>

      <div className="glass-card p-6 rounded-xl border space-y-4">
        <h2 className="text-lg font-semibold text-white">Add Warehouse</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. LAG-01)" className="bg-surface-2 border rounded-lg px-4 py-2 text-white" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="bg-surface-2 border rounded-lg px-4 py-2 text-white" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="bg-surface-2 border rounded-lg px-4 py-2 text-white" />
        </div>
        <div className="flex justify-end">
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">Create</button>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-white">View stock at</label>
          <select value={activeWh} onChange={(e) => setActiveWh(e.target.value)} className="bg-surface-2 border rounded-lg px-4 py-2 text-white">
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </div>

        {activeWh && (
          <>
            <DataTable columns={stockColumns} data={levels} />

            <div className="border-t border-white/10 pt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Product</label>
                <select value={transfer.productId} onChange={(e) => setTransfer({ ...transfer, productId: e.target.value })} className="w-full bg-surface-2 border rounded-lg px-3 py-2 text-white">
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To warehouse</label>
                <select value={transfer.toWarehouseId} onChange={(e) => setTransfer({ ...transfer, toWarehouseId: e.target.value })} className="w-full bg-surface-2 border rounded-lg px-3 py-2 text-white">
                  <option value="">Select…</option>
                  {warehouses.filter((w) => w.id !== activeWh).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Qty</label>
                <input type="number" min={1} value={transfer.quantity} onChange={(e) => setTransfer({ ...transfer, quantity: Number(e.target.value) })} className="w-full bg-surface-2 border rounded-lg px-3 py-2 text-white" />
              </div>
              <button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending} className="btn-primary">Transfer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
