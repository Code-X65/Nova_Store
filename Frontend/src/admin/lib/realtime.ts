import { api } from '@/admin/lib/api';

export interface AdminRealtimeEvent {
  type: string;
  userId?: string;
  targetUserId?: string;
  actor?: string;
  at?: number;
  [key: string]: unknown;
}

const BASE_URL = import.meta.env.VITE_ADMIN_API_URL || '/api/v1';
export const STREAM_URL = `${BASE_URL}/admin/stream`;
