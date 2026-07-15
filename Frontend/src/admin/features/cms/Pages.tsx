import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { fetchPages, createPage, updatePage, deletePage, type CmsPage } from './api/cms';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

const emptyForm = { slug: '', title: '', content: '', status: 'draft' as CmsPage['status'], meta_title: '', meta_description: '' };

const columnHelper = createColumnHelper<CmsPage>();

export default function Pages() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: pages = [], isLoading } = useQuery({ queryKey: ['admin-cms-pages'], queryFn: fetchPages });

  const saveMutation = useMutation({
    mutationFn: () => (editingId ? updatePage(editingId, form) : createPage(form)),
    onSuccess: () => {
      toast.success(editingId ? 'Page updated' : 'Page created');
      qc.invalidateQueries({ queryKey: ['admin-cms-pages'] });
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to save page'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePage(id),
    onSuccess: () => {
      toast.success('Page deleted');
      qc.invalidateQueries({ queryKey: ['admin-cms-pages'] });
    },
  });

  const startEdit = (p: CmsPage) => {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      title: p.title,
      content: p.content || '',
      status: p.status,
      meta_title: p.meta_title || '',
      meta_description: p.meta_description || '',
    });
    setShowForm(true);
  };

  const columns = [
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => <span className="text-white font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('slug', {
      header: 'Slug',
      cell: (info) => <span className="text-gray-400 font-mono text-xs">/{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${info.getValue() === 'published' ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 bg-white/5'}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const p = info.row.original;
        return (
          <div className="text-right">
            <button onClick={(e) => { e.stopPropagation(); startEdit(p); }} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 mr-1">
              <PencilIcon className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this page?')) deleteMutation.mutate(p.id); }} className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-red-500/10">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        );
      },
    }),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Static Pages</h1>
          <p className="text-sm text-gray-400 mt-1">About, FAQ, Terms, and other static content pages.</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm((s) => !s); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> New Page
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
              <label className="text-sm font-medium text-white">Slug * (e.g. about-us)</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono" disabled={!!editingId} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Content (HTML or Markdown)</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Meta Title</label>
              <input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-sm text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg">Cancel</button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title || !form.slug} className="btn-primary disabled:opacity-50">
              {editingId ? 'Save Changes' : 'Create Page'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-black rounded-xl overflow-hidden border border-white/10">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : pages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No pages yet.</div>
        ) : (
          <DataTable columns={columns} data={pages} />
        )}
      </div>
    </div>
  );
}
