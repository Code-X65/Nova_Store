import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';

export default function RoleManager() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [colorCode, setColorCode] = useState('#ffffff');

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles');
      return data.data; // array
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: name.toUpperCase(), display_name: displayName, description, color_code: colorCode };
      if (editingId) {
        return api.patch(`/roles/${editingId}`, payload);
      } else {
        return api.post('/roles', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Role updated' : 'Role created');
      qc.invalidateQueries({ queryKey: ['roles'] });
      resetForm();
    },
    onError: () => toast.error('Failed to save role')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      toast.success('Role deleted');
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: () => toast.error('Failed to delete role')
  });

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDisplayName('');
    setDescription('');
    setColorCode('#ffffff');
  };

  const handleEdit = (role: any) => {
    if (role.is_system) {
      toast.error('System roles cannot be edited');
      return;
    }
    setEditingId(role.id);
    setName(role.name);
    setDisplayName(role.display_name);
    setDescription(role.description || '');
    setColorCode(role.color_code || '#ffffff');
  };

  const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.roles || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Role Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Define roles to manage staff access.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading roles...</p>
          ) : (
            <div className="space-y-4">
              {roles.map((role: any) => (
                <div key={role.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color_code || '#ffffff' }} />
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {role.display_name}
                        {role.is_system && <span className="text-[10px] uppercase bg-white/10 px-1.5 py-0.5 rounded text-muted-foreground">System</span>}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!role.is_system && (
                      <>
                        <button onClick={() => handleEdit(role)} className="px-3 py-1 bg-white/5 text-muted-foreground hover:text-white rounded text-xs font-medium transition-colors">
                          Edit
                        </button>
                        <button onClick={() => { if(confirm('Delete?')) deleteMutation.mutate(role.id); }} className="px-3 py-1 bg-danger/10 text-danger hover:bg-danger/20 rounded text-xs font-medium transition-colors">
                          Delete
                        </button>
                      </>
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
            {editingId ? 'Edit Role' : 'Create Custom Role'}
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Internal Name (uppercase, no spaces)</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toUpperCase())}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                placeholder="e.g. MARKETING_LEAD"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                placeholder="e.g. Marketing Lead"
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Color Tag</label>
              <input
                type="color"
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                className="w-full h-10 bg-surface-2 border border-white/10 rounded-lg p-1 cursor-pointer"
              />
            </div>

            <div className="pt-4 flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-surface-2 border border-white/10 rounded-lg">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending || !name || !displayName} className="flex-1 btn-primary">
                {editingId ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}