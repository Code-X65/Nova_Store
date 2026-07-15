import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchReviewReports, resolveReviewReport, dismissReviewReport } from './api/reviews';
import toast from 'react-hot-toast';

export default function ReviewReports() {
 const qc = useQueryClient();
 const [page, setPage] = useState(1);
 const [status, setStatus] = useState('pending'); // pending, resolved, dismissed

 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-review-reports', page, status],
 queryFn: async () => fetchReviewReports({ page, limit: 20, status })
 });

 const resolveMutation = useMutation({
 mutationFn: async ({ id, action_taken }: { id: string, action_taken: string }) => resolveReviewReport(id, action_taken),
 onSuccess: () => {
 toast.success('Report resolved');
 qc.invalidateQueries({ queryKey: ['admin-review-reports'] });
 },
 onError: () => toast.error('Failed to resolve report')
 });

 const dismissMutation = useMutation({
 mutationFn: async (id: string) => dismissReviewReport(id),
 onSuccess: () => {
 toast.success('Report dismissed');
 qc.invalidateQueries({ queryKey: ['admin-review-reports'] });
 },
 onError: () => toast.error('Failed to dismiss report')
 });

 const reports = response?.reports || [];

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Review Reports</h1>
 <p className="text-sm text-muted-foreground mt-1">Manage user-flagged product reviews.</p>
 </div>
 </div>

 <div className="flex gap-2">
 {['pending', 'resolved', 'dismissed'].map(tab => (
 <button
 key={tab}
 onClick={() => { setStatus(tab); setPage(1); }}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 status === tab 
 ? 'bg-nova-500/20 text-nova-400 border border-nova-500/30' 
 : 'bg-surface-2 text-muted-foreground hover:bg-white/10'
 }`}
 >
 {tab.charAt(0).toUpperCase() + tab.slice(1)}
 </button>
 ))}
 </div>

 <div className="glass-card p-4 rounded-xl border space-y-4">
 {isLoading ? (
 <p className="text-muted-foreground">Loading reports...</p>
 ) : reports.length === 0 ? (
 <p className="text-muted-foreground">No {status} reports found.</p>
 ) : (
 <div className="space-y-4">
 {reports.map((report: any) => (
 <div key={report.id} className="p-4 bg-surface-2 rounded-lg border space-y-4">
 
 <div className="flex justify-between items-start">
 <div>
 <h3 className="text-sm font-semibold text-danger">Reason: {report.reason}</h3>
 <p className="text-sm text-muted-foreground mt-1">Reported by User #{report.user_id}</p>
 </div>
 {status === 'pending' && (
 <div className="flex gap-2">
 <button 
 onClick={() => {
 const action = prompt('Action taken (e.g.,"Deleted review and warned user"):');
 if (action) resolveMutation.mutate({ id: report.id, action_taken: action });
 }}
 className="px-3 py-1 bg-success/20 text-success rounded text-xs font-medium hover:bg-success/30 transition-colors"
 >
 Resolve
 </button>
 <button 
 onClick={() => dismissMutation.mutate(report.id)}
 className="px-3 py-1 bg-white/5 text-muted-foreground hover:text-white rounded text-xs font-medium hover:bg-white/10 transition-colors"
 >
 Dismiss
 </button>
 </div>
 )}
 </div>

 {report.review && (
 <div className="p-3 bg-white/5 rounded border">
 <p className="text-xs text-muted-foreground mb-1">Target Review:</p>
 <p className="text-sm text-gray-300">"{report.review.comment}"</p>
 </div>
 )}
 
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}