import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function MyPermissions() {
  const { data: myPerms, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: async () => {
      const { data } = await api.get('/admin/my-permissions');
      return data.data; // { roles, permissions }
    }
  });

  if (isLoading) return <div className="text-muted-foreground p-8">Loading your access profile...</div>;

  const roles = myPerms?.roles || [];
  const permissions = myPerms?.permissions || [];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">My Permissions</h1>
        <p className="text-sm text-muted-foreground mt-1">Review your current access levels and capabilities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-nova-400" />
            Assigned Roles
          </h2>
          <div className="space-y-3">
            {roles.map((role: any) => (
              <div key={role.id || role} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-nova-500" />
                <span className="font-medium text-white">{typeof role === 'string' ? role : role.name}</span>
              </div>
            ))}
            {roles.length === 0 && <p className="text-muted-foreground text-sm">No roles assigned.</p>}
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
            Granted Permissions
          </h2>
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {permissions.map((perm: string) => (
              <div key={perm} className="px-3 py-2 bg-surface-2 rounded-lg border border-white/5 text-sm font-medium text-gray-300 font-mono">
                {perm}
              </div>
            ))}
            {permissions.length === 0 && <p className="text-muted-foreground text-sm">No permissions granted.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}