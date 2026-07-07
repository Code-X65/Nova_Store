import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Categories() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data; // array
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return api.patch(`/categories/${editingId}`, { name, description });
      } else {
        return api.post('/categories', { name, description });
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Category updated' : 'Category created');
      qc.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
    },
    onError: () => toast.error('Failed to save category')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      toast.success('Category deleted');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => toast.error('Failed to delete category')
  });

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const handleEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
  };

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.categories || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage product classification.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat: any) => (
                <div key={cat.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{cat.name}</h3>
                    {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(cat)} className="p-2 text-muted-foreground hover:text-white rounded hover:bg-white/10">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if(confirm('Delete?')) deleteMutation.mutate(cat.id); }} className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="text-muted-foreground text-sm">No categories found.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 sticky top-24">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Category' : 'Add Category'}
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="pt-4 flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-surface-2 border border-white/10 rounded-lg">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending || !name} className="flex-1 btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}