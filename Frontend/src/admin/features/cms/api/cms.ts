import { api } from '@/admin/lib/api';

export interface CmsBanner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  position: 'hero' | 'secondary' | 'sidebar';
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  status: 'draft' | 'published';
  meta_title: string | null;
  meta_description: string | null;
}

export interface CmsBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  status: 'draft' | 'published';
  created_at: string;
}

// Banners
export async function fetchBanners() {
  const { data } = await api.get('/admin/cms/banners');
  return data.data.banners as CmsBanner[];
}
export async function createBanner(payload: Partial<CmsBanner>) {
  const { data } = await api.post('/admin/cms/banners', payload);
  return data.data.banner as CmsBanner;
}
export async function updateBanner(id: string, payload: Partial<CmsBanner>) {
  const { data } = await api.patch(`/admin/cms/banners/${id}`, payload);
  return data.data.banner as CmsBanner;
}
export async function deleteBanner(id: string) {
  await api.delete(`/admin/cms/banners/${id}`);
}

// Pages
export async function fetchPages() {
  const { data } = await api.get('/admin/cms/pages');
  return data.data.pages as CmsPage[];
}
export async function createPage(payload: Partial<CmsPage>) {
  const { data } = await api.post('/admin/cms/pages', payload);
  return data.data.page as CmsPage;
}
export async function updatePage(id: string, payload: Partial<CmsPage>) {
  const { data } = await api.patch(`/admin/cms/pages/${id}`, payload);
  return data.data.page as CmsPage;
}
export async function deletePage(id: string) {
  await api.delete(`/admin/cms/pages/${id}`);
}

// Blog posts
export async function fetchBlogPosts() {
  const { data } = await api.get('/admin/cms/blog', { params: { limit: 100 } });
  return data.data.data as CmsBlogPost[];
}
export async function createBlogPost(payload: Partial<CmsBlogPost>) {
  const { data } = await api.post('/admin/cms/blog', payload);
  return data.data.post as CmsBlogPost;
}
export async function updateBlogPost(id: string, payload: Partial<CmsBlogPost>) {
  const { data } = await api.patch(`/admin/cms/blog/${id}`, payload);
  return data.data.post as CmsBlogPost;
}
export async function deleteBlogPost(id: string) {
  await api.delete(`/admin/cms/blog/${id}`);
}
