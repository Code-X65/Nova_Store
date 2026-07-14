import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface AdjustStockForm {
  actionType: 'add' | 'reduce';
  productId: string;
  quantity: number;
  reasonCode: string; // damaged, restock, correction, return, loss, other
  notes: string;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
}

export default function StockAdjust() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultProductId = searchParams.get('product') || '';

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<AdjustStockForm>({
  defaultValues: {
  actionType: 'add',
  productId: defaultProductId,
  quantity: 1,
  reasonCode: 'restock',
  notes: '',
  }
  });

  const actionType = watch('actionType');
  const selectedProductId = watch('productId');

  const { data: productsData, isLoading: productsLoading } = useQuery({
  queryKey: ['products-list-minimal'],
  queryFn: async () => {
  const { data } = await api.get('/products', { params: { limit: 500 } });
  return data.data.products || [];
  }
  });

  const { data: selectedProduct } = useQuery({
  queryKey: ['product-detail', selectedProductId],
  queryFn: async () => {
  const { data } = await api.get(`/inventory/${selectedProductId}`);
  return data.data;
  },
  enabled: !!selectedProductId,
  });

  const variants: ProductVariant[] = selectedProduct?.variants || [];

  const adjustMutation = useMutation({
  mutationFn: async (data: AdjustStockForm) => {
  const quantityChange = data.actionType === 'add' ? data.quantity : -data.quantity;
  
  const payload = {
    productId: data.productId,
    quantityChange,
    reasonCode: data.reasonCode,
    notes: data.notes
  };

  return api.post('/inventory/adjust', payload);
  },
  onSuccess: () => {
  toast.success('Stock adjusted successfully');
  reset();
  qc.invalidateQueries({ queryKey: ['inventory'] });
  qc.invalidateQueries({ queryKey: ['analytics', 'inventory-stats'] });
  navigate('/inventory');
  },
  onError: (error: any) => {
  toast.error(error.response?.data?.message || 'Failed to adjust stock');
  }
  });

  const onSubmit = (data: AdjustStockForm) => {
  adjustMutation.mutate(data);
  };

  return (
  <div className="max-w-2xl space-y-6">
  <div>
  <h1 className="text-2xl font-bold text-white">Adjust Stock</h1>
  <p className="text-sm text-muted-foreground mt-1">
  Manually add or reduce stock for a specific product.
  </p>
  </div>

  <div className="glass-card p-6 rounded-xl border">
  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
  
  <div className="space-y-2">
  <label className="text-sm font-medium text-white">Action</label>
  <div className="flex gap-4">
  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
  <input 
  type="radio" 
  value="add" 
  {...register('actionType')}
  className="text-nova-500 focus:ring-nova-500 bg-surface-2" 
  />
  Add Stock
  </label>
  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
  <input 
  type="radio" 
  value="reduce" 
  {...register('actionType')}
  className="text-nova-500 focus:ring-nova-500 bg-surface-2" 
  />
  Reduce Stock
  </label>
  </div>
  </div>

  <div className="space-y-2">
  <label className="text-sm font-medium text-white">Product</label>
  <select
  {...register('productId', { required: 'Please select a product' })}
  className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
  disabled={productsLoading}
  >
  <option value="">Select a product...</option>
  {productsData?.map((p: any) => (
  <option key={p.id} value={p.id}>
  {p.name} ({p.sku}) - Current: {p.stock_quantity}
  </option>
  ))}
  </select>
  {errors.productId && <p className="text-xs text-danger">{errors.productId.message}</p>}
  </div>

  {variants.length > 0 && (
  <div className="space-y-2">
  <label className="text-sm font-medium text-white">Variants</label>
  <div className="bg-surface-2 border rounded-lg divide-y divide-[#1a1a1a]">
  {variants.map((v: ProductVariant) => (
  <div key={v.id} className="flex items-center justify-between px-4 py-2">
  <div>
  <span className="text-sm text-white">{v.name}</span>
  <span className="text-xs text-muted-foreground ml-2">({v.sku})</span>
  </div>
  <span className={clsx('text-sm font-medium', v.stock_quantity <= 0 ? 'text-danger' : v.stock_quantity <= (selectedProduct?.low_stock_threshold || 0) ? 'text-warning' : 'text-success')}>
  {v.stock_quantity} in stock
  </span>
  </div>
  ))}
  </div>
  <p className="text-xs text-muted-foreground">Variant stock is adjusted together with the base product.</p>
  </div>
  )}

  <div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
  <label className="text-sm font-medium text-white">Quantity</label>
  <input
  type="number"
  min="1"
  {...register('quantity', { required: true, min: 1, valueAsNumber: true })}
  className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
  />
  </div>
  
  <div className="space-y-2">
  <label className="text-sm font-medium text-white">Reason Code</label>
  <select
  {...register('reasonCode')}
  className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
  >
  {actionType === 'add' ? (
  <>
  <option value="restock">Manual Restock</option>
  <option value="correction">Inventory Correction (Found items)</option>
  <option value="return">Customer Return (Restockable)</option>
  <option value="other">Other</option>
  </>
  ) : (
  <>
  <option value="damaged">Damaged / Defective</option>
  <option value="loss">Loss / Theft</option>
  <option value="correction">Inventory Correction (Missing items)</option>
  <option value="return">Return to Supplier</option>
  <option value="other">Other</option>
  </>
  )}
  </select>
  </div>
  </div>

  <div className="space-y-2">
  <label className="text-sm font-medium text-white">Notes (Optional)</label>
  <textarea
  {...register('notes')}
  rows={3}
  placeholder="e.g. Found in backroom, damaged during transit..."
  className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 resize-none"
  />
  </div>

  <div className="pt-4 flex justify-end">
  <button
  type="submit"
  disabled={adjustMutation.isPending}
  className="btn-primary"
  >
  {adjustMutation.isPending ? 'Processing...' : 'Submit Adjustment'}
  </button>
  </div>

  </form>
  </div>
  </div>
  );
}