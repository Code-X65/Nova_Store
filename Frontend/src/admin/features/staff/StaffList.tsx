import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStaff, revokeStaffAccess } from './api/staff';
import toast from 'react-hot-toast';
import { TrashIcon, KeyIcon, PaperAirplaneIcon, MagnifyingGlassIcon, LockClosedIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { EditStaffAccessModal } from './EditStaffAccessModal';
import { RemoveAdminDialog } from './RemoveAdminDialog';
import { Link } from 'react-router-dom';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { useAdminSession } from '@/admin/hooks/useAdminSession';
import { isOwner, hasPermission } from '@/admin/lib/permissions';
import { LockUnlockButton } from './LockUnlockButton';
export default function StaffList() {
 const qc = useQueryClient();
 const perms = useMyPermissions();
 const { session } = useAdminSession();
 const meId = session?.id;
 const canManageStaff = hasPermission(perms, 'staff:write');
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [editingStaff, setEditingStaff] = useState<{ id: string, name: string } | null>(null);
 const [removingStaff, setRemovingStaff] = useState<{ id: string, name: string } | null>(null);

 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-staff', page, search],
 queryFn: async () => fetchStaff({ page, limit: 20, search })
 });

 const revokeMutation = useMutation({
 mutationFn: async (id: string) => {
 return revokeStaffAccess(id);
 },
 onSuccess: () => {
 toast.success('Admin access revoked');
 qc.invalidateQueries({ queryKey: ['admin-staff'] });
 },
 onError: (err: any) => {
 const errorData = err.response?.data?.error;
 const errorMsg = typeof errorData === 'object' ? errorData?.message : errorData;
 toast.error(err.response?.data?.message || errorMsg || 'Failed to revoke access');
 }
 });

 const admins = response?.admins || [];

 const getRoleBadge = (roleName: string) => {
 const name = roleName?.toUpperCase();
 if (name === 'STORE_OWNER') {
 return (
 <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
 Owner
 </span>
 );
 }
 if (name === 'MANAGER') {
 return (
 <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
 Manager
 </span>
 );
 }
 if (name === 'INVENTORY_STAFF') {
 return (
 <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
 Inventory
 </span>
 );
 }
 if (name === 'ORDER_STAFF') {
 return (
 <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
 Orders
 </span>
 );
 }
 return (
 <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-lg bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
 {roleName || 'Staff'}
 </span>
 );
 };

 return (
 <div className="space-y-8 w-full">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h1 className="text-3xl font-extrabold text-white tracking-tight">Staff Directory</h1>
 <p className="text-sm text-white/50 mt-1">Manage team members and configure their administrative access levels.</p>
 </div>
 <div className="flex items-center gap-3">
 <Link 
 to="/staff/invitations" 
 className="px-5 py-2.5 bg-nova-600 hover:bg-nova-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-nova-600/10 hover:shadow-nova-500/20 hover:-translate-y-0.5 flex items-center gap-2"
 >
 <PaperAirplaneIcon className="w-4 h-4" />
 Invite Staff
 </Link>
 </div>
 </div>

 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/[0.02] border p-4 rounded-2xl backdrop-blur-xl">
 <div className="relative w-full sm:max-w-md">
 <MagnifyingGlassIcon className="w-5 h-5 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
 <input
 type="text"
 placeholder="Search staff by name or email..."
 value={search}
 onChange={(e) => { setSearch(e.target.value); setPage(1); }}
 className="w-full bg-white/[0.03] border rounded-xl pl-12 pr-4 py-2.5 text-white text-sm focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-all placeholder:text-white/20"
 />
 </div>
 <div className="text-xs text-white/40">
 Showing {admins.length} of {response?.total || 0} team members
 </div>
 </div>

 {/* Grid */}
 {isLoading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {[1, 2, 3].map((n) => (
 <div key={n} className="h-60 bg-white/[0.02] border rounded-2xl animate-pulse" />
 ))}
 </div>
 ) : admins.length === 0 ? (
 <div className="glass-card py-20 flex flex-col items-center justify-center text-white/30 border rounded-2xl bg-white/[0.02]">
 <p className="text-lg font-semibold">No staff members found</p>
 <p className="text-sm mt-1">Try resetting your search query or inviting a new member.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {admins.map((admin: any) => {
 const initials = `${admin.first_name?.[0] || ''}${admin.last_name?.[0] || ''}`.toUpperCase();
 const displayName = `${admin.first_name} ${admin.last_name}`;
 const isActive = admin.is_active;
 const isLocked = admin.is_locked;
 const isSelf = admin.id === meId;

 return (
 <div
 key={admin.id}
 className="bg-white/[0.02] border hover:border-nova-500/30 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-nova-500/5 group relative overflow-hidden animate-fadeIn"
 >
 {/* Visual Accent Overlay */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-nova-500/10 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

 <div>
 <div className="flex items-start justify-between">
 {/* Avatar Initials */}
 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nova-500/20 to-sky-500/20 border border-nova-500/20 flex items-center justify-center text-sm font-bold text-nova-400 group-hover:scale-105 transition-transform duration-300">
 {initials || '?'}
 </div>

 {/* Status Badge */}
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
 !isActive
 ? 'bg-white/5 text-white/40 border '
 : isLocked
 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
 : 'bg-success/10 text-success border border-success/15'
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${!isActive ? 'bg-white/30' : isLocked ? 'bg-amber-400' : 'bg-success animate-pulse'}`} />
 {!isActive ? 'Suspended' : isLocked ? 'Locked' : 'Active'}
 </span>
 </div>

 <div className="mt-4">
 <h3 className="font-bold text-white text-base group-hover:text-nova-400 transition-colors line-clamp-1">{displayName}</h3>
 <p className="text-xs text-white/50 mt-1 line-clamp-1">{admin.email}</p>
 </div>

 <div className="mt-4 flex items-center gap-2">
 {getRoleBadge(admin.role)}
 </div>
 </div>

 <div className="mt-6 pt-4 border-t flex gap-2.5">
 <button
 onClick={() => setEditingStaff({ id: admin.id, name: displayName })}
 className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 hover:text-white border text-xs text-white/80 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 font-semibold"
 title="Permissions & Roles"
 >
 <KeyIcon className="w-3.5 h-3.5" />
 Permissions
 </button>
 {canManageStaff && !isSelf && (
 <LockUnlockButton adminId={admin.id} isLocked={!!admin.is_locked} />
 )}

 {canManageStaff && !isSelf && (
 <button
 onClick={() => {
 if (confirm(`Revoke administrative access for ${displayName}?`)) {
 revokeMutation.mutate(admin.id);
 }
 }}
 className="py-2 px-3 bg-danger/10 hover:bg-danger/25 text-danger rounded-xl transition-all duration-200 flex items-center justify-center border border-danger/15"
 title="Revoke Admin Access"
 >
 <TrashIcon className="w-4 h-4" />
 </button>
 )}

 {isOwner(perms) && !isSelf && (
 <button
 onClick={() => setRemovingStaff({ id: admin.id, name: displayName })}
 className="py-2 px-3 bg-danger/20 hover:bg-danger/40 text-danger rounded-xl transition-all duration-200 flex items-center justify-center border border-danger/30"
 title="Permanently Remove Administrator"
 >
 <ExclamationTriangleIcon className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Pagination */}
 {response?.total > 20 && (
 <div className="flex justify-center items-center gap-2 mt-8">
 <button 
 disabled={page === 1}
 onClick={() => setPage(p => p - 1)}
 className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-xl text-xs text-white border font-semibold transition-all"
 >
 Previous
 </button>
 <span className="text-xs text-white/50 px-3">
 Page {page} of {Math.ceil(response.total / 20)}
 </span>
 <button 
 disabled={page * 20 >= response.total}
 onClick={() => setPage(p => p + 1)}
 className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-xl text-xs text-white border font-semibold transition-all"
 >
 Next
 </button>
 </div>
 )}

 <EditStaffAccessModal
 isOpen={!!editingStaff}
 onClose={() => setEditingStaff(null)}
 staffId={editingStaff?.id || null}
 staffName={editingStaff?.name || ''}
 />

 <RemoveAdminDialog
 isOpen={!!removingStaff}
 onClose={() => setRemovingStaff(null)}
 targetId={removingStaff?.id || null}
 targetName={removingStaff?.name || ''}
 />

 </div>
 );
}