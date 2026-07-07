import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function Invitations() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles'); // assuming /api/v1/roles is public/admin accessible
      return data.data;
    }
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const { data } = await api.get('/admin/invitations');
      return data.data; // { invitations }
    }
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      return api.post('/admin/invitations', { email, role_id: roleId });
    },
    onSuccess: () => {
      toast.success('Invitation sent!');
      qc.invalidateQueries({ queryKey: ['admin-invitations'] });
      setEmail('');
      setRoleId('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    }
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/invitations/${id}`);
    },
    onSuccess: () => {
      toast.success('Invitation revoked');
      qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: () => toast.error('Failed to revoke invitation')
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/admin/invitations/${id}/resend`);
    },
    onSuccess: () => {
      toast.success('Invitation resent!');
    },
    onError: () => toast.error('Failed to resend invitation')
  });

  const invitations = response?.invitations || [];
  const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.roles || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pending Invitations</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage invites sent to prospective staff.</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : invitations.length === 0 ? (
            <p className="text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv: any) => (
                <div key={inv.id} className="p-4 bg-surface-2 rounded-lg border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{inv.email}</div>
                    <div className="text-xs text-muted-foreground flex gap-4 mt-1">
                      <span>Role: {inv.role_display_name || inv.role_name || 'Staff'}</span>
                      <span>Expires: {format(new Date(inv.expires_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resendMutation.mutate(inv.id)}
                      className="p-2 text-muted-foreground hover:text-white rounded hover:bg-white/10"
                      title="Resend Invite"
                    >
                      <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Revoke this invitation?')) revokeMutation.mutate(inv.id);
                      }}
                      className="p-2 text-muted-foreground hover:text-danger rounded hover:bg-danger/10"
                      title="Revoke Invite"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 sticky top-24">
          <h2 className="text-lg font-semibold text-white mb-4">Send Invite</h2>
          
          <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
                placeholder="staff@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Assign Role</label>
              <select
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              >
                <option value="">Select a role...</option>
                {roles.filter((r: any) => r.name !== 'STORE_OWNER').map((r: any) => (
                  <option key={r.id} value={r.id}>{r.display_name}</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={inviteMutation.isPending || !email || !roleId} className="w-full btn-primary mt-4">
              Send Invitation
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}