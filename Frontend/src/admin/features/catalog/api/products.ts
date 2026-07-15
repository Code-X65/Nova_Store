import { api } from '@/admin/lib/api';

// ── Products ─────────────────────────────────────────────────────────────

/** Fetch products using a pre-built query string (caller controls which filters are included). */
export async function fetchProducts(searchParams: URLSearchParams) {
  const { data } = await api.get(`/products?${searchParams.toString()}`);
  return data.data; // { products, pagination }
}

export async function fetchProductsList(params: { limit?: number; search?: string } = {}) {
  const { data } = await api.get('/products', { params });
  return data;
}

export async function fetchProductById(id: string) {
  const { data } = await api.get(`/products/${id}`);
  return data.data.product;
}

export async function createProduct(payload: any) {
  return api.post('/products', payload);
}

export async function updateProduct(id: string, payload: any) {
  return api.patch(`/products/${id}`, payload);
}

export async function archiveProduct(id: string) {
  return api.delete(`/products/${id}`);
}

export async function fetchPriceRange() {
  const { data } = await api.get('/products/price-range');
  return data.data; // { min, max }
}

export async function bulkImportProducts(products: any[]) {
  const { data } = await api.post('/products/bulk', products);
  return data;
}

// ── Product images / gallery ────────────────────────────────────────────

export async function addProductImage(productId: string, imageUrl: string) {
  return api.post(`/products/${productId}/images`, { imageUrl });
}

export async function removeProductImage(productId: string, index: number) {
  return api.delete(`/products/${productId}/images/${index}`);
}

// ── Product variants ─────────────────────────────────────────────────────

export async function addProductVariant(productId: string, payload: any) {
  const { data } = await api.post(`/products/${productId}/variants`, payload);
  return data;
}

export async function updateProductVariant(productId: string, variantId: string, payload: any) {
  const { data } = await api.put(`/products/${productId}/variants/${variantId}`, payload);
  return data;
}

export async function deleteProductVariant(productId: string, variantId: string) {
  return api.delete(`/products/${productId}/variants/${variantId}`);
}

// ── Variant option matrix (admin) ───────────────────────────────────────

export async function fetchVariantOptions(productId: string) {
  const { data } = await api.get(`/admin/products/${productId}/variant-options`);
  return data.data as { options: any[]; variants: any[] };
}

export async function saveVariantOptions(productId: string, options: any[]) {
  const { data } = await api.post(`/admin/products/${productId}/variant-options`, { options });
  return data.data;
}

// ── Related products ─────────────────────────────────────────────────────

export async function fetchRelatedProducts(productId: string) {
  const { data } = await api.get(`/products/${productId}/related`);
  return data.data.relatedProducts || [];
}

export async function addRelatedProduct(productId: string, relatedId: string) {
  return api.post(`/products/${productId}/related`, { relatedId });
}

export async function removeRelatedProduct(productId: string, relatedId: string) {
  return api.delete(`/products/${productId}/related/${relatedId}`);
}

// ── Generic bulk import job (multi-entity: product/category/inventory/variant) ─

export async function startImportJob(entityType: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('entityType', entityType);
  const { data } = await api.post('/admin/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data as { jobId: string; status: string };
}

export async function fetchImportJob(jobId: string) {
  const { data } = await api.get(`/admin/import/${jobId}`);
  return data.data;
}

// ── Catalog audit trail ──────────────────────────────────────────────────

export async function fetchCatalogAuditLogs(queryString: string) {
  const { data } = await api.get(`/admin/audit/catalog?${queryString}`);
  return data.data;
}

export async function exportCatalogAuditLogs(queryString: string) {
  const { data } = await api.get(`/admin/audit/catalog/export?${queryString}`, { responseType: 'blob' });
  return data;
}
