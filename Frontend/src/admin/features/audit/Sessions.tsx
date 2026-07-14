import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { TrashIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

export default function SessionsPage() {
  const qc = useQueryClient();
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/admin/sessions');
      return data.data;
    }
  });

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => api.delete(`/admin/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success('Session revoked');
      qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      setRevokeTarget(null);
    },
    onError: () => toast.error('Failed to revoke session')
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => api.delete('/admin/sessions'),
    onSuccess: () => {
      toast.success('All other sessions revoked');
      qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      setShowRevokeAll(false);
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
          onClick={() => setShowRevokeAll(true)}
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
                    onClick={() => setRevokeTarget(session.id)}
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

      {/* Revoke Single Session Modal */}
      <Transition show={!!revokeTarget} as="div" className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setRevokeTarget(null)}
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
            <h3 className="text-lg font-bold text-white mb-2">Revoke Session</h3>
            <p className="text-sm text-gray-300 mb-6">Are you sure you want to revoke this session? The user will be logged out immediately.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRevokeTarget(null)} className="px-4 py-2 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget)} className="px-4 py-2 rounded-lg text-sm bg-danger text-white hover:bg-danger/80 transition-colors">Revoke</button>
            </div>
          </Transition.Child>
        </div>
      </Transition>

      {/* Revoke All Sessions Modal */}
      <Transition show={showRevokeAll} as="div" className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRevokeAll(false)}
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
            <h3 className="text-lg font-bold text-white mb-2">Revoke All Other Sessions</h3>
            <p className="text-sm text-gray-300 mb-6">This will log out all other active sessions for your account. Are you sure?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRevokeAll(false)} className="px-4 py-2 rounded-lg text-sm bg-surface-2 text-white hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={() => revokeAllMutation.mutate()} className="px-4 py-2 rounded-lg text-sm bg-danger text-white hover:bg-danger/80 transition-colors">Revoke All</button>
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </div>
  );
}
