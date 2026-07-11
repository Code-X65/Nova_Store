import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';

interface InviteDetails {
 id: string;
 email: string;
 roleId: string;
 roleName: string;
 storeName: string;
 expiresAt: string;
 status: string;
}

export function useAcceptInviteToken(token: string) {
 return useQuery({
 queryKey: ['invite-token', token],
 queryFn: async () => {
 const { data } = await api.get<{ data: InviteDetails }>(`/accept-invite/${token}`);
 return data.data;
 },
 enabled: !!token,
 retry: false,
 });
}

export function useAcceptInvite() {
 return useMutation({
 mutationFn: async ({ token, firstName, lastName, password }: { token: string; firstName: string; lastName: string; password: string }) => {
 const { data } = await api.post(`/accept-invite/${token}`, { firstName, lastName, password });
 return data;
 },
 });
}
