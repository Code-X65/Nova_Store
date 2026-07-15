import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNotificationTemplates, createNotificationTemplate, updateNotificationTemplate, deleteNotificationTemplate } from './api/notifications';
import toast from 'react-hot-toast';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

export default function Templates() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: ''
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['admin-notification-templates'],
    queryFn: fetchNotificationTemplates
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return updateNotificationTemplate(editingId, formData);
      } else {
        return createNotificationTemplate(formData);
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
    mutationFn: async (id: string) => deleteNotificationTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      qc.invalidateQueries({ queryKey: ['admin-notification-templates'] });
      setDeleteTarget(null);
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notification Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage automated email and notification templates.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground">No templates configured.</p>
          ) : (
            <div className="space-y-4">
              {templates.map((tpl: any) => (
                <div key={tpl.id} className="p-4 bg-surface-2 rounded-lg border flex items-start justify-between">
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
                      <button onClick={() => setDeleteTarget(tpl.id)} className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10">
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
          <div className="glass-card p-6 rounded-xl border sticky top-24">
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
                className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Subject</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Body (Supports Variables like {'{user_name}'})</label>
              <textarea
                required
                rows={8}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              />
            </div>

            <div className="pt-4 flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-surface-2 border rounded-lg">
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

      {/* Delete Confirmation Modal */}
      <Transition show={!!deleteTarget} as="div" className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
            className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] p-6 text-left align-middle shadow-xl transition-all"
          >
            <h3 className="text-lg font-bold text-white mb-2">Delete Template</h3>
            <p className="text-sm text-gray-300 mb-6">Are you sure you want to delete this template? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} className="px-4 py-2 rounded-lg text-sm bg-danger text-white hover:bg-danger/80 transition-colors">Delete</button>
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </div>
  );
}
