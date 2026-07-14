import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchTickets, createTicket, updateTicket, addTicketMessage, fetchBreachingSla, type Ticket, type TicketMessage } from './api/tickets';

const statusColor = (s: string) => {
  if (s === 'closed' || s === 'resolved') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s === 'in_progress') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (s === 'waiting_customer') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

const priorityColor = (p: string) => {
  if (p === 'urgent') return 'bg-red-500/10 text-red-400';
  if (p === 'high') return 'bg-orange-500/10 text-orange-400';
  if (p === 'medium') return 'bg-yellow-500/10 text-yellow-400';
  return 'bg-gray-500/10 text-gray-400';
};

export default function Tickets() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');
  const [breaching, setBreaching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets', { breaching }],
    queryFn: () => fetchTickets({ page: 1, limit: 20, breaching }),
  });

  const tickets: Ticket[] = data?.tickets || [];

  const createMut = useMutation({
    mutationFn: () => createTicket({ subject, description: desc, priority, category }),
    onSuccess: () => { toast.success('Ticket created'); qc.invalidateQueries({ queryKey: ['admin-tickets'] }); setSubject(''); setDesc(''); setCategory(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...patch }: any) => updateTicket(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tickets'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const msgMut = useMutation({
    mutationFn: ({ id, message }: any) => addTicketMessage(id, message),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tickets'] }); setMsg(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const sendMsg = () => {
    if (!selectedId || !msg.trim()) return;
    msgMut.mutate({ id: selectedId, message: msg });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Support Tickets</h1>

      <div className="bg-black rounded-xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !subject} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Open Ticket</button>
      </div>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-white/10">
              <tr>
                <th className="text-left p-3">Ticket</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">SLA Due</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className={`border-b border-white/5 cursor-pointer ${selectedId === t.id ? 'bg-white/5' : ''}`} onClick={() => setSelectedId(t.id)}>
                  <td className="p-3 text-gray-200 font-mono text-xs">{t.ticket_number}</td>
                  <td className="p-3 text-gray-300">{t.subject}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${priorityColor(t.priority)}`}>{t.priority}</span></td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs border ${statusColor(t.status)}`}>{t.status}</span></td>
                  <td className="p-3 text-gray-400 text-xs">{t.sla_due_at ? new Date(t.sla_due_at).toLocaleString() : '—'}</td>
                  <td className="p-3 text-right">
                    <select value={t.status} onChange={(e) => { e.stopPropagation(); updateMut.mutate({ id: t.id, status: e.target.value }); }} className="bg-black border border-white/10 rounded p-1 text-gray-200 outline-none text-xs">
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_customer">Waiting Customer</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No tickets found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <div className="bg-black rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">Ticket Messages</h3>
          <div className="flex gap-3">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type a message…" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none flex-1" onKeyDown={(e) => e.key === 'Enter' && sendMsg()} />
            <button onClick={sendMsg} disabled={msgMut.isPending || !msg.trim()} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
