import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { GlobeAltIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

const ALL_ROLES = ['STORE_OWNER', 'SUPER_ADMIN', 'MANAGER', 'CATALOG_MANAGER', 'LOGISTICS_COORDINATOR', 'CUSTOMER_SUPPORT', 'FINANCE_AUDITOR', 'MARKETING_SPECIALIST'];

interface IpAllowlistEntry {
  id: string;
  ip_cidr: string;
  label: string | null;
  role_scope: string[];
  is_active: boolean;
  created_at: string;
}

export default function IpAllowlist() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<IpAllowlistEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ip_cidr: '',
    label: '',
    role_scope: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'],
    is_active: true,
  });

  const { data: resp, isLoading } = useQuery({
    queryKey: ['ip-allowlist'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: IpAllowlistEntry[] }>('/admin/ip-allowlist');
      return data.data;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ip_cidr: '', label: '', role_scope: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'], is_active: true });
    setShowForm(true);
  };

  const openEdit = (entry: IpAllowlistEntry) => {
    setEditing(entry);
    setForm({
      ip_cidr: entry.ip_cidr,
      label: entry.label || '',
      role_scope: entry.role_scope || [],
      is_active: entry.is_active,
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ip_cidr: form.ip_cidr,
        label: form.label || null,
        role_scope: form.role_scope,
        is_active: form.is_active,
      };
      if (editing) {
        await api.put(`/admin/ip-allowlist/${editing.id}`, payload);
      } else {
        await api.post('/admin/ip-allowlist', payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Allowlist entry updated' : 'Allowlist entry created');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['ip-allowlist'] });
    },
    onError: () => toast.error('Failed to save entry'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/ip-allowlist/${id}`),
    onSuccess: () => {
      toast.success('Entry removed');
      qc.invalidateQueries({ queryKey: ['ip-allowlist'] });
    },
    onError: () => toast.error('Failed to remove entry'),
  });

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      role_scope: f.role_scope.includes(role)
        ? f.role_scope.filter((r) => r !== role)
        : [...f.role_scope, role],
    }));
  };

  const entries = resp || [];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">IP Allowlist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Restrict admin access for sensitive roles to approved IP ranges (CIDR).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-nova-500 text-white rounded-lg text-sm font-medium hover:bg-nova-600 transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> Add Range
        </button>
      </div>

      <div className="glass-card p-4 rounded-xl border">
        {isLoading ? (
          <p className="text-muted-foreground p-4">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground p-4">No allowlist entries. All admin roles are unrestricted by IP.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-white/10">
                  <th className="py-2 px-3">CIDR</th>
                  <th className="py-2 px-3">Label</th>
                  <th className="py-2 px-3">Applies To</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 font-mono text-white">{e.ip_cidr}</td>
                    <td className="py-2 px-3 text-gray-300">{e.label || '—'}</td>
                    <td className="py-2 px-3 text-gray-300">{e.role_scope?.join(', ') || '—'}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${e.is_active ? 'text-emerald-400 bg-emerald-400/15' : 'text-gray-400 bg-white/10'}`}>
                        {e.is_active ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(e)} className="p-1.5 text-muted-foreground hover:text-white rounded hover:bg-white/10" title="Edit">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(e.id)} className="p-1.5 text-muted-foreground hover:text-danger rounded hover:bg-danger/10" title="Delete">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      <Transition show={showForm} as="div" className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Transition.Child
            enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <Transition.Child
            enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4"
            className="relative w-full max-w-lg transform overflow-hidden rounded-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] p-6 text-left align-middle shadow-xl transition-all"
          >
            <div className="flex items-center gap-2 mb-4">
              <GlobeAltIcon className="w-5 h-5 text-nova-400" />
              <h3 className="text-lg font-bold text-white">{editing ? 'Edit IP Range' : 'Add IP Range'}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">CIDR range</label>
                <input
                  value={form.ip_cidr}
                  onChange={(e) => setForm({ ...form, ip_cidr: e.target.value })}
                  placeholder="192.168.1.0/24 or 10.0.0.1"
                  className="w-full bg-[#111111] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-nova-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Office VPN"
                  className="w-full bg-[#111111] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-nova-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Applies to roles</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ALL_ROLES.map((role) => {
                    const active = form.role_scope.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-nova-500/20 text-nova-400 border-nova-500/30' : 'bg-surface-2 text-muted-foreground border-white/10'}`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-600 bg-[#111111] text-nova-500 focus:ring-nova-500"
                />
                Active
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Cancel</button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.ip_cidr || form.role_scope.length === 0}
                className="px-4 py-2 rounded-lg text-sm bg-nova-500 text-white hover:bg-nova-600 disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </div>
  );
}
