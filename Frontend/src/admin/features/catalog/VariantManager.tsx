import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchProductsList, fetchVariantOptions, saveVariantOptions } from './api/products';

interface ProductLite { id: string; name: string; sku: string; }
interface OptionDef { name: string; values: string[]; }

export default function VariantManagerPage() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [options, setOptions] = useState<OptionDef[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: ['products-list-minimal'],
    queryFn: async () => {
      const data = await fetchProductsList({ limit: 500 });
      return (data.data.products as ProductLite[]) || [];
    },
  });

  const { data: current, isLoading } = useQuery({
    queryKey: ['variant-options', productId],
    enabled: !!productId,
    queryFn: async () => {
      return fetchVariantOptions(productId) as Promise<{ options: OptionDef[]; variants: any[] }>;
    },
  });

  useEffect(() => {
    if (current?.options) {
      setOptions(current.options.map((o: any) => ({ name: o.name, values: (o.product_option_values || []).map((v: any) => v.value) })));
    }
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = options
        .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
        .filter((o) => o.name && o.values.length > 0);
      return saveVariantOptions(productId, cleaned);
    },
    onSuccess: () => {
      toast.success('Variant matrix rebuilt');
      qc.invalidateQueries({ queryKey: ['variant-options', productId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to save variants'),
  });

  const addOption = () => setOptions((o) => [...o, { name: '', values: [] }]);
  const updateOption = (i: number, patch: Partial<OptionDef>) =>
    setOptions((o) => o.map((opt, idx) => (idx === i ? { ...opt, ...patch } : opt)));
  const removeOption = (i: number) => setOptions((o) => o.filter((_, idx) => idx !== i));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Variant Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define option groups (e.g. Size, Color). Variants are generated as the cartesian product.
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl border space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading…</p>}

        {productId && (
          <>
            <div className="space-y-3">
              {options.map((opt, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end border-b border-white/5 pb-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Option name</label>
                    <input
                      value={opt.name}
                      onChange={(e) => updateOption(i, { name: e.target.value })}
                      placeholder="Size"
                      className="w-full bg-surface-2 border rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="space-y-1 flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Values (comma separated)</label>
                      <input
                        value={opt.values.join(', ')}
                        onChange={(e) => updateOption(i, { values: e.target.value.split(',').map((s) => s.trim()) })}
                        placeholder="S, M, L, XL"
                        className="w-full bg-surface-2 border rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <button onClick={() => removeOption(i)} className="text-danger text-sm px-2">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addOption} className="btn-ghost">+ Add option group</button>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {current ? `${current.variants.length} current variants` : ''}
              </span>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Saving…' : 'Generate / Update Variants'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
