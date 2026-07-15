import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ImageUploadInput } from '@/admin/components/ui/ImageUploadInput';
import { fetchBanners, createBanner, updateBanner, deleteBanner, type CmsBanner } from './api/cms';

const emptyForm = { title: '', image_url: '', link_url: '', position: 'hero' as const, is_active: true };

export default function Banners() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: banners = [], isLoading } = useQuery({ queryKey: ['admin-cms-banners'], queryFn: fetchBanners });

  const createMutation = useMutation({
    mutationFn: () => createBanner(form),
    onSuccess: () => {
      toast.success('Banner created');
      qc.invalidateQueries({ queryKey: ['admin-cms-banners'] });
      setForm(emptyForm);
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to create banner'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateBanner(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-cms-banners'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      toast.success('Banner deleted');
      qc.invalidateQueries({ queryKey: ['admin-cms-banners'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Banners</h1>
          <p className="text-sm text-gray-400 mt-1">Homepage hero and promotional banners.</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> New Banner
        </button>
      </div>

      {showForm && (
        <div className="bg-black rounded-xl p-6 border border-white/10 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Position</label>
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                <option value="hero">Hero</option>
                <option value="secondary">Secondary</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Image *</label>
            <ImageUploadInput value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Link URL</label>
            <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title || !form.image_url}
              className="btn-primary disabled:opacity-50"
            >
              Create Banner
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-400 col-span-full">Loading…</p>
        ) : banners.length === 0 ? (
          <p className="text-gray-400 col-span-full">No banners yet.</p>
        ) : (
          banners.map((b) => (
            <div key={b.id} className="bg-black rounded-xl border border-white/10 overflow-hidden">
              <img src={b.image_url} alt={b.title} className="w-full h-32 object-cover" />
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-sm">{b.title}</span>
                  <span className="text-xs text-gray-500 uppercase">{b.position}</span>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={b.is_active} onChange={(e) => toggleMutation.mutate({ id: b.id, is_active: e.target.checked })} className="rounded bg-white/5 text-nova-500" />
                    Active
                  </label>
                  <button onClick={() => { if (confirm('Delete this banner?')) deleteMutation.mutate(b.id); }} className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-red-500/10">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
