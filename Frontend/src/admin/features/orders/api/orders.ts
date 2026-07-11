import { api } from '@/admin/lib/api';

export interface Order {
 id: string;
 order_number: string;
 status: string;
 delivery_status: string;
 total_amount: number;
 payment_status: string;
 created_at: string;
 user: {
 first_name: string;
 last_name: string;
 email: string;
 };
}

export interface PaginatedOrders {
 orders: Order[];
 total: number;
 pages: number;
 currentPage: number;
}

export async function fetchOrders(params: {
 page?: number;
 limit?: number;
 status?: string;
 dateFrom?: string;
 dateTo?: string;
}): Promise<PaginatedOrders> {
 const { data } = await api.get('/orders/admin/list', { params });
 return data;
}

export async function fetchDispatchQueue(params: {
 page?: number;
 limit?: number;
 status?: string;
 deliveryStatus?: string;
}): Promise<PaginatedOrders> {
 const { data } = await api.get('/orders/admin/dispatch-queue', { params });
 return data;
}

export async function fetchOrderDetails(id: string): Promise<{ order: any }> {
 const { data } = await api.get(`/orders/admin/${id}`);
 return data.data;
}

// Actions
export async function markReadyForDispatch(id: string, note?: string) {
 const { data } = await api.post(`/orders/admin/${id}/ready`, { note });
 return data;
}

export async function dispatchOrder(id: string, payload: { driverName: string; driverPhone?: string; dispatchNotes?: string; deliveryWindow?: string }) {
 const { data } = await api.post(`/orders/admin/${id}/dispatch`, payload);
 return data;
}

export async function updateOrderStatus(id: string, payload: { status: string; note?: string }) {
 const { data } = await api.patch(`/orders/admin/${id}`, payload);
 return data;
}
