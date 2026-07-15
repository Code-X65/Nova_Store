import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRoles } from './api/roles';
import { fetchInvitations, sendInvitation, revokeInvitation, resendInvitation } from './api/invitations';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function Invitations() {
 const qc = useQueryClient();
 const [email, setEmail] = useState('');
 const [roleId, setRoleId] = useState('');

 const { data: rolesData } = useQuery({
 queryKey: ['roles'],
 queryFn: fetchRoles // assuming /api/v1/roles is public/admin accessible
 });

 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-invitations'],
 queryFn: async () => fetchInvitations({ status: 'pending' })
 });

 const inviteMutation = useMutation({
 mutationFn: async () => {
 return sendInvitation(email, roleId);
 },
 onSuccess: () => {
 toast.success('Invitation sent!');
 qc.invalidateQueries({ queryKey: ['admin-invitations'] });
 setEmail('');
 setRoleId('');
 },
 onError: (err: any) => {
 const errorData = err.response?.data?.error;
 const errorMsg = typeof errorData === 'object' ? errorData?.message : errorData;
 toast.error(err.response?.data?.message || errorMsg || 'Failed to send invite');
 }
 });

 const revokeMutation = useMutation({
 mutationFn: async (id: string) => {
 return revokeInvitation(id);
 },
 onSuccess: () => {
 toast.success('Invitation revoked');
 qc.invalidateQueries({ queryKey: ['admin-invitations'] });
 },
 onError: (err: any) => {
 const errorData = err.response?.data?.error;
 const errorMsg = typeof errorData === 'object' ? errorData?.message : errorData;
 toast.error(err.response?.data?.message || errorMsg || 'Failed to revoke invitation');
 }
 });

 const resendMutation = useMutation({
 mutationFn: async (id: string) => {
 return resendInvitation(id);
 },
 onSuccess: () => {
 toast.success('Invitation resent!');
 },
 onError: (err: any) => {
 const errorData = err.response?.data?.error;
 const errorMsg = typeof errorData === 'object' ? errorData?.message : errorData;
 toast.error(err.response?.data?.message || errorMsg || 'Failed to resend invitation');
 }
 });

 const invitations = response?.invitations || [];
 const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.roles || []);

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
 {/* Invite Form */}
 <div className="lg:col-span-5 space-y-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Invite Staff</h1>
 <p className="text-sm text-muted-foreground mt-1">Send a registration link to add new members.</p>
 </div>

 <div className="glass-card p-6 rounded-2xl border bg-white/[0.03] backdrop-blur-xl shadow-2xl space-y-6">
 <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-6">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white/90">Email Address</label>
 <div className="relative">
 <input
 type="email"
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-all placeholder:text-white/20"
 placeholder="staff@example.com"
 />
 </div>
 </div>
 
 <div className="space-y-2">
 <label htmlFor="role-select" className="text-sm font-medium text-white/90">Assign Role</label>
 <select
 id="role-select"
 value={roleId}
 onChange={(e) => setRoleId(e.target.value)}
 required
 className="w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-all appearance-none"
 >
 <option value="" disabled>Select a role…</option>
 {roles.filter((r: any) => r.name !== 'STORE_OWNER').map((r: any) => (
 <option key={r.id} value={r.id} className="bg-nova-900 text-white">
 {r.display_name}
 </option>
 ))}
 </select>
 </div>

 <button 
 type="submit" 
 disabled={inviteMutation.isPending || !email || !roleId} 
 className="w-full py-3.5 px-4 bg-nova-600 hover:bg-nova-500 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-nova-600/20 hover:shadow-nova-500/30 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none"
 >
 <PaperAirplaneIcon className="w-4 h-4" />
 {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
 </button>
 </form>
 </div>
 </div>

 {/* Pending Invitations */}
 <div className="lg:col-span-7 space-y-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Pending Invitations</h1>
 <p className="text-sm text-muted-foreground mt-1">Manage invites sent to prospective staff.</p>
 </div>

 <div className="glass-card p-6 rounded-2xl border bg-white/[0.03] backdrop-blur-xl shadow-2xl min-h-[400px] flex flex-col">
 {isLoading ? (
 <div className="flex-1 flex items-center justify-center">
 <div className="animate-pulse text-white/50">Loading invitations...</div>
 </div>
 ) : invitations.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center text-white/30 py-20">
 <PaperAirplaneIcon className="w-12 h-12 stroke-[1] mb-3 opacity-50" />
 <p className="text-sm">No pending invitations.</p>
 </div>
 ) : (
 <div className="space-y-4">
 {invitations.map((inv: any) => {
 const matchedRole = roles.find((r: any) => r.name === inv.role_name || r.id === inv.role_id);
 const color = matchedRole?.color_code || '#ffffff';
 return (
 <div 
 key={inv.id} 
 className="p-5 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border hover: flex items-center justify-between transition-all duration-300 group hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
 >
 <div className="space-y-1">
 <div className="font-semibold text-white group-hover:text-nova-400 transition-colors">{inv.email}</div>
 <div className="text-xs text-white/40 flex flex-wrap gap-x-4 gap-y-1">
 <span className="flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
 {inv.role_display_name || inv.role_name || 'Staff'}
 </span>
 <span>Expires: {format(new Date(inv.expires_at), 'MMM d, yyyy')}</span>
 </div>
 </div>
 
 <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() => resendMutation.mutate(inv.id)}
 className="p-2.5 text-white/70 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200"
 title="Resend Invite"
 >
 <PaperAirplaneIcon className="w-4 h-4" />
 </button>
 <button
 onClick={() => {
 if (confirm('Revoke this invitation?')) revokeMutation.mutate(inv.id);
 }}
 className="p-2.5 text-white/40 hover:text-danger rounded-lg bg-danger/10 hover:bg-danger/20 transition-all duration-200"
 title="Revoke Invite"
 >
 <TrashIcon className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}