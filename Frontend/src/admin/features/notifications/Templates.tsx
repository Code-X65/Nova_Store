import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Templates() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: ''
  });

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['admin-notification-templates'],
    queryFn: async () => {
      const { data } = await api.get('/admin/notifications/templates');
      return data.data; // array
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return api.patch(`/admin/notifications/templates/${editingId}`, formData);
      } else {
        return api.post('/admin/notifications/templates', formData);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Template updated' : 'Template created');
      qc.invalidateQueries({ queryKey: ['admin-notification-templates'] });
      resetForm();
    },
    onError: () => toast.error('Failed to save template')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/notifications/templates/${id}`);
    },
    onSuccess: () => {
      toast.success('Template deleted');
      qc.invalidateQueries({ queryKey: ['admin-notification-templates'] });
    },
    onError: () => toast.error('Failed to delete template')
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', subject: '', body: '' });
  };

  const handleEdit = (tpl: any) => {
    setEditingId(tpl.id);
    setFormData({
      name: tpl.name,
      subject: tpl.subject,
      body: tpl.body
    });
  };

  const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.templates || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notification Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage automated email and notification templates.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground">No templates configured.</p>
          ) : (
            <div className="space-y-4">
              {templates.map((tpl: any) => (
                <div key={tpl.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{tpl.name}</h3>
                    <div className="text-sm text-nova-400 mt-1">Subject: {tpl.subject}</div>
                    <pre className="text-xs text-muted-foreground mt-2 bg-black/20 p-2 rounded overflow-x-auto">
                      {tpl.body}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => handleEdit(tpl)} className="p-2 text-muted-foreground hover:text-white rounded hover:bg-white/10">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    {!tpl.is_system && (
                      <button onClick={() => { if(confirm('Delete?')) deleteMutation.mutate(tpl.id); }} className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 sticky top-24">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Template' : 'Create Template'}
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Internal Name (e.g. ORDER_CONFIRMATION)</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.replace(/\s+/g, '_').toUpperCase() })}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Subject</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Body (Supports Variables like {'{user_name}'})</label>
              <textarea
                required
                rows={8}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="pt-4 flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-surface-2 border border-white/10 rounded-lg">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending || !formData.name || !formData.body} className="flex-1 btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}