import { useQuery } from '@tanstack/react-query';
import { fetchMyPermissions } from './api/staff';
import { ShieldCheckIcon, ClockIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

export default function MyPermissions() {
 const { data: myPerms, isLoading } = useQuery({
 queryKey: ['my-permissions'],
 queryFn: fetchMyPermissions,
 refetchOnWindowFocus: true,
 staleTime: 60 * 1000,
 });

 if (isLoading) return <div className="text-muted-foreground p-8">Loading your access profile...</div>;

 const roles = myPerms?.roles || [];
 const permissions: string[] = myPerms?.permissions || [];
 const rolePermissions: string[] = myPerms?.rolePermissions || [];

 const rolePermSet = new Set(rolePermissions);
 const isWildcard = permissions.includes('*') || rolePermissions.includes('*');

 const provenanceOf = (perm: string): { label: string; cls: string } => {
 if (rolePermSet.has(perm)) return { label: 'role', cls: 'bg-nova-500/15 text-nova-300' };
 return { label: 'granted', cls: 'bg-white/10 text-white/50' };
 };

 return (
 <div className="w-full space-y-8">
 <div>
 <h1 className="text-2xl font-bold text-white">My Permissions</h1>
 <p className="text-sm text-muted-foreground mt-1">Review your current access levels and where each capability comes from.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="glass-card p-6 rounded-xl border space-y-4">
 <h2 className="text-lg font-semibold text-white border-b pb-2 flex items-center gap-2">
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

 <div className="glass-card p-6 rounded-xl border space-y-4">
 <h2 className="text-lg font-semibold text-white border-b pb-2">
 Granted Permissions
 </h2>
 {isWildcard ? (
 <div className="px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-sm font-medium text-emerald-300">
 Full access (Store Owner) — all permissions granted.
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
 {permissions.map((perm: string) => {
 const p = provenanceOf(perm);
 return (
 <div key={perm} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg border">
 <span className="text-sm font-medium text-gray-300 font-mono truncate">{perm}</span>
 <span className={`ml-2 shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${p.cls}`}>{p.label}</span>
 </div>
 );
 })}
 {permissions.length === 0 && <p className="text-muted-foreground text-sm">No permissions granted.</p>}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
