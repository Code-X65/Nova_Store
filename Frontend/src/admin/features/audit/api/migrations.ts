import { api } from '@/admin/lib/api';

export async function fetchMigrationsStatus(): Promise<any> {
  const { data } = await api.get('/admin/migrations/status');
  return data.data; // { applied_migrations: [], pending_migrations: [] }
}
