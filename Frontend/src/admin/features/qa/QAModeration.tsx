import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchQuestions, answerQuestion, moderateQuestion, deleteQuestion } from './api/qa';

export default function QAModeration() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-qa', status],
    queryFn: () => fetchQuestions({ status, page: 1, limit: 20 }),
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) => answerQuestion(id, answer),
    onSuccess: () => {
      toast.success('Answer posted');
      qc.invalidateQueries({ queryKey: ['admin-qa'] });
    },
    onError: () => toast.error('Failed to post answer'),
  });

  const hideMutation = useMutation({
    mutationFn: (id: string) => moderateQuestion(id, 'hidden'),
    onSuccess: () => {
      toast.success('Question hidden');
      qc.invalidateQueries({ queryKey: ['admin-qa'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: () => {
      toast.success('Question deleted');
      qc.invalidateQueries({ queryKey: ['admin-qa'] });
    },
  });

  const questions = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Product Q&amp;A</h1>
        <p className="text-sm text-gray-400 mt-1">Answer or moderate customer questions about products.</p>
      </div>

      <div className="flex gap-2">
        {['pending', 'approved', 'hidden'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatus(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === tab ? 'bg-nova-500/20 text-nova-400 border border-nova-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-black rounded-xl p-4 border border-white/10 space-y-4">
        {isLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-gray-400">No {status} questions.</p>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="p-4 bg-white/5 rounded-lg border border-white/10 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-nova-400">{q.product?.name || 'Unknown product'}</div>
                  <div className="text-sm text-gray-300 mt-1">
                    <span className="font-medium text-white">{q.user ? `${q.user.first_name} ${q.user.last_name}` : 'Customer'}</span> asked:
                  </div>
                  <p className="text-sm text-white mt-1">{q.question}</p>
                </div>
                <div className="flex gap-2">
                  {status !== 'hidden' && (
                    <button onClick={() => hideMutation.mutate(q.id)} className="px-3 py-1 bg-white/5 text-gray-400 hover:text-white rounded text-xs font-medium hover:bg-white/10">
                      Hide
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm('Delete permanently?')) deleteMutation.mutate(q.id); }}
                    className="px-3 py-1 bg-red-500/10 text-red-400 rounded text-xs font-medium hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {q.answer ? (
                <div className="pl-4 border-l-2 border-nova-500/30 text-sm text-gray-300">
                  <span className="text-nova-400 font-medium">Store reply: </span>{q.answer}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write an answer…"
                    value={drafts[q.id] || ''}
                    onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      const answer = drafts[q.id]?.trim();
                      if (answer) answerMutation.mutate({ id: q.id, answer });
                    }}
                    disabled={answerMutation.isPending || !drafts[q.id]?.trim()}
                    className="btn-primary text-sm px-4 disabled:opacity-50"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
