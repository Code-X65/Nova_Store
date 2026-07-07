import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface AdjustStockForm {
  actionType: 'add' | 'reduce';
  productId: string;
  quantity: number;
  type: string; // for reduce only
  notes: string;
}

export default function StockAdjust() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultProductId = searchParams.get('product') || '';

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<AdjustStockForm>({
    defaultValues: {
      actionType: 'add',
      productId: defaultProductId,
      quantity: 1,
      type: 'adjustment',
      notes: '',
    }
  });

  const actionType = watch('actionType');

  // Fetch products for the dropdown
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-list-minimal'],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { limit: 500 } });
      return data.data.products || [];
    }
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: AdjustStockForm) => {
      const payload = {
        productId: data.productId,
        quantity: data.quantity,
        notes: data.notes
      };

      if (data.actionType === 'add') {
        return api.post('/inventory/stock', payload);
      } else {
        return api.post('/inventory/reduce', {
          ...payload,
          type: data.type
        });
      }
    },
    onSuccess: () => {
      toast.success('Stock adjusted successfully');
      reset();
      navigate('/admin/inventory');
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

      <div className="glass-card p-6 rounded-xl border border-white/5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Action</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="radio" 
                  value="add" 
                  {...register('actionType')}
                  className="text-nova-500 focus:ring-nova-500 bg-surface-2 border-gray-700" 
                />
                Add Stock
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="radio" 
                  value="reduce" 
                  {...register('actionType')}
                  className="text-nova-500 focus:ring-nova-500 bg-surface-2 border-gray-700" 
                />
                Reduce Stock
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Product</label>
            <select
              {...register('productId', { required: 'Please select a product' })}
              className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Quantity</label>
              <input
                type="number"
                min="1"
                {...register('quantity', { required: true, min: 1, valueAsNumber: true })}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            
            {actionType === 'reduce' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Reason (Type)</label>
                <select
                  {...register('type')}
                  className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                >
                  <option value="adjustment">Manual Adjustment (Loss/Damage)</option>
                  <option value="sale">Manual Sale</option>
                  <option value="return">Return to Supplier</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Notes (Optional)</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="e.g. Found in backroom, damaged during transit..."
              className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 resize-none"
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