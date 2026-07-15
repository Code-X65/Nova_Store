import { api } from '@/admin/lib/api';

export interface ProductQuestion {
  id: string;
  product_id: string;
  user_id: string;
  question: string;
  status: 'pending' | 'approved' | 'hidden';
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  user?: { id: string; first_name: string; last_name: string; email: string };
  product?: { id: string; name: string };
}

export async function fetchQuestions(params: { status?: string; page?: number; limit?: number } = {}) {
  const { data } = await api.get('/admin/qa', { params });
  return data.data as { data: ProductQuestion[]; count: number; page: number; limit: number };
}

export async function answerQuestion(id: string, answer: string) {
  const { data } = await api.patch(`/admin/qa/${id}/answer`, { answer });
  return data.data.question as ProductQuestion;
}

export async function moderateQuestion(id: string, status: 'pending' | 'approved' | 'hidden') {
  const { data } = await api.patch(`/admin/qa/${id}`, { status });
  return data.data.question as ProductQuestion;
}

export async function deleteQuestion(id: string) {
  await api.delete(`/admin/qa/${id}`);
}
