import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { StarIcon } from '@heroicons/react/20/solid';

export default function ReviewsModeration() {
 const qc = useQueryClient();
 const [page, setPage] = useState(1);
 const [status, setStatus] = useState('pending'); // pending, approved, rejected

 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-reviews', page, status],
 queryFn: async () => {
 const { data } = await api.get('/admin/reviews', {
 params: { page, limit: 20, status }
 });
 return data.data; // { reviews }
 }
 });

 const moderateMutation = useMutation({
 mutationFn: async ({ id, newStatus }: { id: string, newStatus: string }) => {
 return api.patch(`/admin/reviews/${id}`, { status: newStatus });
 },
 onSuccess: () => {
 toast.success('Review moderated');
 qc.invalidateQueries({ queryKey: ['admin-reviews'] });
 },
 onError: () => toast.error('Failed to moderate review')
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: string) => {
 return api.delete(`/admin/reviews/${id}`);
 },
 onSuccess: () => {
 toast.success('Review deleted');
 qc.invalidateQueries({ queryKey: ['admin-reviews'] });
 },
 onError: () => toast.error('Failed to delete review')
 });

 const reviews = response?.reviews || [];

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Review Moderation</h1>
 <p className="text-sm text-muted-foreground mt-1">Approve or reject customer product reviews.</p>
 </div>
 </div>

 <div className="flex gap-2">
 {['pending', 'approved', 'rejected'].map(tab => (
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
 <p className="text-muted-foreground">Loading reviews...</p>
 ) : reviews.length === 0 ? (
 <p className="text-muted-foreground">No {status} reviews found.</p>
 ) : (
 <div className="space-y-4">
 {reviews.map((review: any) => (
 <div key={review.id} className="p-4 bg-surface-2 rounded-lg border flex flex-col gap-4">
 <div className="flex justify-between items-start">
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-white">{review.user?.first_name || 'Anonymous'}</span>
 <span className="text-xs text-muted-foreground">on {new Date(review.created_at).toLocaleDateString()}</span>
 </div>
 <div className="text-xs text-nova-400 mt-1">Product: {review.product?.name || 'Unknown'}</div>
 <div className="flex mt-1">
 {[1, 2, 3, 4, 5].map(star => (
 <StarIcon key={star} className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-600'}`} />
 ))}
 </div>
 </div>
 <div className="flex gap-2">
 {status !== 'approved' && (
 <button 
 onClick={() => moderateMutation.mutate({ id: review.id, newStatus: 'approved' })}
 className="px-3 py-1 bg-success/20 text-success rounded text-xs font-medium hover:bg-success/30 transition-colors"
 >
 Approve
 </button>
 )}
 {status !== 'rejected' && (
 <button 
 onClick={() => moderateMutation.mutate({ id: review.id, newStatus: 'rejected' })}
 className="px-3 py-1 bg-danger/20 text-danger rounded text-xs font-medium hover:bg-danger/30 transition-colors"
 >
 Reject
 </button>
 )}
 <button 
 onClick={() => { if(confirm('Delete permanently?')) deleteMutation.mutate(review.id); }}
 className="px-3 py-1 bg-white/5 text-muted-foreground hover:text-white rounded text-xs font-medium hover:bg-white/10 transition-colors"
 >
 Delete
 </button>
 </div>
 </div>
 
 {review.title && <h4 className="font-semibold text-white text-sm">{review.title}</h4>}
 <p className="text-sm text-gray-300">{review.comment}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}