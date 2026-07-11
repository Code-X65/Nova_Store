import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { TrashIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

export default function SessionsPage() {
 const qc = useQueryClient();

 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-sessions'],
 queryFn: async () => {
 const { data } = await api.get('/admin/sessions');
 return data.data; // { sessions }
 }
 });

 const revokeMutation = useMutation({
 mutationFn: async (sessionId: string) => {
 return api.delete(`/admin/sessions/${sessionId}`);
 },
 onSuccess: () => {
 toast.success('Session revoked');
 qc.invalidateQueries({ queryKey: ['admin-sessions'] });
 },
 onError: () => toast.error('Failed to revoke session')
 });

 const revokeAllMutation = useMutation({
 mutationFn: async () => {
 return api.delete('/admin/sessions');
 },
 onSuccess: () => {
 toast.success('All other sessions revoked');
 qc.invalidateQueries({ queryKey: ['admin-sessions'] });
 },
 onError: () => toast.error('Failed to revoke sessions')
 });

 const sessions = response?.sessions || [];

 return (
 <div className="w-full space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Active Sessions</h1>
 <p className="text-sm text-muted-foreground mt-1">Manage logged-in devices for your account (and others if you are an owner).</p>
 </div>
 <button
 onClick={() => {
 if (confirm('Are you sure you want to revoke ALL other sessions?')) {
 revokeAllMutation.mutate();
 }
 }}
 className="flex items-center gap-2 px-4 py-2 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg text-sm font-medium transition-colors"
 >
 <ShieldExclamationIcon className="w-4 h-4" />
 Revoke All Others
 </button>
 </div>

 <div className="glass-card p-4 rounded-xl border space-y-4">
 {isLoading ? (
 <p className="text-muted-foreground p-4">Loading sessions...</p>
 ) : sessions.length === 0 ? (
 <p className="text-muted-foreground p-4">No active sessions found.</p>
 ) : (
 <div className="grid gap-4">
 {sessions.map((session: any) => (
 <div key={session.id} className="p-4 bg-surface-2 rounded-lg border flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium text-white">{session.ip_address}</span>
 {session.is_current && (
 <span className="px-2 py-0.5 bg-nova-500/20 text-nova-400 text-[10px] font-bold uppercase rounded">
 Current
 </span>
 )}
 </div>
 <div className="text-sm text-muted-foreground mt-1">
 {session.user_agent}
 </div>
 <div className="text-xs text-gray-500 mt-2">
 Started: {session.created_at ? format(new Date(session.created_at), 'MMM d, yyyy HH:mm') : 'Unknown'} | 
 Last Active: {session.last_active_at ? format(new Date(session.last_active_at), 'MMM d, yyyy HH:mm') : 'Unknown'}
 </div>
 </div>
 {!session.is_current && (
 <button
 onClick={() => {
 if (confirm('Revoke this session?')) revokeMutation.mutate(session.id);
 }}
 className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10"
 title="Revoke Session"
 >
 <TrashIcon className="w-5 h-5" />
 </button>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}