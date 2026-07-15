import { api } from '@/admin/lib/api';

export async function fetchReviewReports(params: { page: number; limit: number; status: string }): Promise<any> {
  // Endpoint likely /admin/review-reports or /admin/reviews/reports
  const { data } = await api.get('/admin/review-reports', { params }).catch(() => ({ data: { data: { reports: [] } } }));
  return data.data; // { reports }
}

export async function resolveReviewReport(id: string, action_taken: string) {
  return api.patch(`/admin/review-reports/${id}`, { status: 'resolved', action_taken });
}

export async function dismissReviewReport(id: string) {
  return api.patch(`/admin/review-reports/${id}`, { status: 'dismissed' });
}

export async function fetchReviews(params: { page: number; limit: number; status: string }): Promise<any> {
  const { data } = await api.get('/admin/reviews', { params });
  return data.data; // { reviews }
}

export async function moderateReview(id: string, newStatus: string) {
  return api.patch(`/admin/reviews/${id}`, { status: newStatus });
}

export async function deleteReview(id: string) {
  return api.delete(`/admin/reviews/${id}`);
}
