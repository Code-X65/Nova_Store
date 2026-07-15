import { api } from '@/admin/lib/api';

export interface AuditVerifyResult {
  total: number;
  verified: boolean;
  verifiedCount: number;
  brokenCount: number;
  broken: { id: string; created_at: string; linkOk: boolean; hashOk: boolean }[];
  verifiedAt: string;
}

export async function verifyAuditChain(): Promise<AuditVerifyResult | null> {
  const { data } = await api.post<{ success: boolean; data: AuditVerifyResult | null }>('/admin/audit/verify');
  return data.data;
}

export async function fetchAuditLogs(logType: string, filters: string): Promise<any> {
  if (logType === 'catalog') {
    const { data } = await api.get(`/admin/audit/catalog?${filters}`);
    return data.data;
  }
  let endpoint = '/admin/audit';
  if (logType === 'auth') endpoint = '/admin/audit/auth';
  if (logType === 'admin-auth') endpoint = '/admin/audit/admin-auth';
  if (logType === 'activity') endpoint = `/admin/audit?${filters}`;
  const { data } = await api.get(endpoint);
  return data.data;
}

export async function exportAuditLogs(logType: string, queryString: string): Promise<Blob> {
  const endpoint = logType === 'catalog' ? '/admin/audit/catalog/export' : '/admin/audit/export';
  const { data } = await api.get(`${endpoint}?${queryString}`, { responseType: 'blob' });
  return data;
}
