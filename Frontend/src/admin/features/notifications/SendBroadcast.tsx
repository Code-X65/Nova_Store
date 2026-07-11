import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { MegaphoneIcon } from '@heroicons/react/24/outline';

export default function SendBroadcast() {
 const [title, setTitle] = useState('');
 const [message, setMessage] = useState('');
 const [targetType, setTargetType] = useState('ALL_CUSTOMERS');

 const broadcastMutation = useMutation({
 mutationFn: async () => {
 return api.post('/admin/notifications/broadcast', {
 title,
 message,
 target_type: targetType
 });
 },
 onSuccess: () => {
 toast.success('Broadcast sent successfully!');
 setTitle('');
 setMessage('');
 },
 onError: () => toast.error('Failed to send broadcast')
 });

 return (
 <div className="max-w-3xl space-y-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-nova-500/20 rounded-lg">
 <MegaphoneIcon className="w-6 h-6 text-nova-400" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-white">Send Broadcast</h1>
 <p className="text-sm text-muted-foreground mt-1">Send a notification to a specific group of users.</p>
 </div>
 </div>

 <div className="glass-card p-6 rounded-xl border space-y-6">
 <form onSubmit={(e) => { e.preventDefault(); broadcastMutation.mutate(); }} className="space-y-4">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Target Audience</label>
 <select
 value={targetType}
 onChange={(e) => setTargetType(e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 >
 <option value="ALL_CUSTOMERS">All Customers</option>
 <option value="ACTIVE_CUSTOMERS">Active Customers (Purchased in last 30d)</option>
 <option value="ALL_STAFF">All Staff Members</option>
 </select>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Notification Title</label>
 <input
 type="text"
 required
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 placeholder="e.g. Holiday Sale Starts Now!"
 />
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white">Message Body</label>
 <textarea
 required
 rows={5}
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 className="w-full bg-surface-2 border rounded-lg px-4 py-2 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 placeholder="Write your message here..."
 />
 </div>

 <div className="pt-4 flex justify-end">
 <button
 type="submit"
 disabled={broadcastMutation.isPending || !title || !message}
 className="btn-primary"
 >
 {broadcastMutation.isPending ? 'Sending...' : 'Send Broadcast'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}