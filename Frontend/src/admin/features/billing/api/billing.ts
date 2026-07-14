import { api } from '@/admin/lib/api';

export interface Invoice {
  id: string;
  order_id: string;
  order_number: string;
  invoice_no: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  pdf_url: string | null;
  issued_at: string;
}

export async function fetchInvoices(params: { page?: number; limit?: number; orderNumber?: string } = {}) {
  const { data } = await api.get('/admin/invoices', { params });
  return data;
}

export async function fetchInvoice(id: string) {
  const { data } = await api.get(`/admin/invoices/${id}`);
  return data.data.invoice as Invoice;
}

export async function generateInvoice(orderId: string) {
  const { data } = await api.post(`/admin/invoices/orders/${orderId}/generate`);
  return data.data.invoice as Invoice;
}

export function invoicePdfUrl(invoice: Invoice) {
  // pdf_url is stored root-relative (e.g. /uploads/invoices/x.pdf) and
  // served by the backend's static handler at the app origin.
  return invoice.pdf_url || '';
}
