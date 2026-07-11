import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';

export interface StoreProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  currency: string;
  timezone: string;
  country: string;
  language: string;
  is_active: boolean;
  is_maintenance_mode: boolean;
  accepts_guest_orders: boolean;
  settings: Record<string, any>;
}

export function useAdminStore() {
  const query = useQuery({
    queryKey: ['admin-store-profile'],
    queryFn: async (): Promise<StoreProfile> => {
      const { data } = await api.get('/admin/store');
      return data.data;
    },
    // Cache the profile aggressively as it rarely changes
    staleTime: 5 * 60 * 1000,
  });

  return {
    store: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
