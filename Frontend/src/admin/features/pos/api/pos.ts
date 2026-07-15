import { api } from '@/admin/lib/api';

export interface PosSaleItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface PosSalePayload {
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: 'cash' | 'pos_card' | 'pos_transfer';
  items: PosSaleItem[];
}

export interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_status: string;
  channel: string;
  customer_email: string | null;
  created_at: string;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  images: string[] | null;
}

export async function searchProducts(term: string) {
  const { data } = await api.get('/products', { params: { search: term, limit: 10 } });
  return (data.data?.products || []) as ProductSearchResult[];
}

export async function createPosSale(payload: PosSalePayload) {
  const { data } = await api.post('/admin/pos/sales', payload);
  return data.data.order as Order;
}

export async function fetchPosSales(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get('/admin/pos/sales', { params });
  return data.data as { orders: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
}
