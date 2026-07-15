import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchInviteDetails, acceptInvite } from '../api/acceptInvite';

export function useAcceptInviteToken(token: string) {
 return useQuery({
 queryKey: ['invite-token', token],
 queryFn: async () => fetchInviteDetails(token),
 enabled: !!token,
 retry: false,
 });
}

export function useAcceptInvite() {
 return useMutation({
 mutationFn: acceptInvite,
 });
}
