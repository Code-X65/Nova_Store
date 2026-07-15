import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CategorySelect } from './categories/CategorySelect';
import { GalleryManager } from './products/GalleryManager';
import { RelatedProductsManager } from './products/RelatedProductsManager';
import { VariantManager } from './products/VariantManager';
import { SearchableSelect } from '@/admin/components/ui/SearchableSelect';
import { fetchProductById, createProduct, updateProduct, addProductVariant, addRelatedProduct } from './api/products';
import { fetchBrands } from './api/brands';
import { fetchCategoryAttributes } from './api/attributes';

const INITIAL_FORM_DATA = {
 name: '',
 sku: '',
 category_id: '',
 brand_id: '',
 status: 'published',
 description: '',
 short_description: '',
 price: 0,
 cost_price: 0,
  currency: 'NGN',
 weight: 0,
 dimensions_length: 0,
 dimensions_width: 0,
 dimensions_height: 0,
 color: '',
 primary_image_url: '',
 thumbnail_url: '',
 meta_title: '',
 meta_description: '',
 meta_keywords: '',
 tags: '', // comma separated string for local state
 attributes: {} as Record<string, any>,
 image_gallery: [] as string[],
 variants: [] as any[],
 related_product_ids: [] as string[],
};

export default function ProductForm() {
 const { id } = useParams();
 const isEditing = Boolean(id);
 const navigate = useNavigate();
 const qc = useQueryClient();

 const [formData, setFormData] = useState(() => ({ ...INITIAL_FORM_DATA }));

 const { data: productData, isLoading: productLoading } = useQuery({
 queryKey: ['product', id],
 queryFn: async () => {
 return fetchProductById(id as string);
 },
 enabled: isEditing,
 });

 const { data: brandsData } = useQuery({
 queryKey: ['brands', { activeOnly: true }],
 queryFn: async () => {
 return fetchBrands({ activeOnly: true });
 }
 });

 const { data: attributesData, isLoading: attributesLoading } = useQuery({
 queryKey: ['attributes', formData.category_id],
 queryFn: async () => {
 return fetchCategoryAttributes(formData.category_id);
 },
 enabled: Boolean(formData.category_id),
 });

 const dataLoadedRef = useRef(false);

 useEffect(() => {
 dataLoadedRef.current = false;
 setFormData({ ...INITIAL_FORM_DATA });
 }, [id]);

 useEffect(() => {
 if (productData && !dataLoadedRef.current) {
 dataLoadedRef.current = true;
 setFormData({
 name: productData.name || '',
 sku: productData.sku || '',
 category_id: productData.category_id || '',
 brand_id: productData.brand_id || '',
 status: productData.status || 'published',
 description: productData.description || '',
 short_description: productData.short_description || '',
 price: Number(productData.price) || 0,
 cost_price: Number(productData.cost_price) || 0,
  currency: productData.currency || 'NGN',
 weight: Number(productData.weight) || 0,
 dimensions_length: Number(productData.dimensions_length) || 0,
 dimensions_width: Number(productData.dimensions_width) || 0,
 dimensions_height: Number(productData.dimensions_height) || 0,
 color: productData.color || '',
 primary_image_url: productData.primary_image_url || '',
 thumbnail_url: productData.thumbnail_url || '',
 meta_title: productData.meta_title || '',
 meta_description: productData.meta_description || '',
 meta_keywords: (productData.meta_keywords || []).join(', '),
 tags: (productData.tags || []).join(', '),
 attributes: Array.isArray(productData.attributes) 
 ? productData.attributes.reduce((acc: any, attr: any) => {
 if (attr.name) acc[attr.name] = attr.value;
 return acc;
 }, {})
 : (productData.attributes || {}),
 image_gallery: productData.image_gallery || [],
 variants: productData.variants || [],
 related_product_ids: [] // We don't load this here because it's fetched by RelatedProductsManager
 });
 }
 }, [productData]);

 const setVal = (key: keyof typeof formData, val: any) => {
 setFormData(prev => ({ ...prev, [key]: val }));
 };

 const setAttribute = (name: string, value: any) => {
 setFormData(prev => ({
 ...prev,
 attributes: {
 ...prev.attributes,
 [name]: value
 }
 }));
 };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        meta_keywords: formData.meta_keywords ? formData.meta_keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
      };

      delete payload.variants;
      delete payload.related_product_ids;

      if (isEditing) {
        return updateProduct(id as string, payload);
      } else {
        return createProduct(payload);
      }
    },
    onSuccess: async (response) => {
      const createdId = !isEditing ? response?.data?.data?.id : null;
      toast.success(isEditing ? 'Product updated' : 'Product created');
      qc.invalidateQueries({ queryKey: ['products'] });

      if (createdId) {
        const validVariants = (formData.variants || []).filter((v: any) => v.name && v.sku);
        const variantPromises = validVariants.map((v: any) => {
          const parsedOptions = typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values;
          return addProductVariant(createdId, {
            sku: v.sku,
            name: v.name,
            option_values: parsedOptions,
            price_modifier: Number(v.price_modifier) || 0,
            sale_price: Number(v.sale_price) || 0,
            stock_quantity: Number(v.stock_quantity) || 0,
            image_url: v.image_url || '',
          });
        });

        const relatedPromises = (formData.related_product_ids || []).map((relatedId: string) =>
          addRelatedProduct(createdId, relatedId)
        );

        const promises = [...variantPromises, ...relatedPromises];
        if (promises.length > 0) {
          const results = await Promise.allSettled(promises);
          const failures = results.filter((r: any) => r.status === 'rejected');
          if (failures.length > 0) {
            toast.error(`Created, but ${failures.length} variant/related save failed`);
          }
        }
      }

      if (!isEditing) {
        navigate('/catalog/products');
      }
    },
 onError: (err: any) => {
 const errorData = err?.response?.data?.error;
 if (errorData?.details?.length) {
 toast.error(`Validation error: ${errorData.details[0].message}`);
 } else {
 toast.error(errorData?.message || 'Failed to save product');
 }
 },
 });

 const inputCls ="input";
 const labelCls ="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5";

 if (isEditing && productLoading) {
 return (
 <div className="space-y-6 max-w-4xl animate-pulse">
 <div className="flex items-center justify-between">
 <div className="w-48 h-8 bg-[var(--neu-bg)] rounded"></div>
 <div className="flex gap-3">
 <div className="w-24 h-10 bg-[var(--neu-bg)] rounded"></div>
 <div className="w-32 h-10 bg-[var(--neu-bg)] rounded"></div>
 </div>
 </div>
 <div className="glass-card rounded-2xl p-8 space-y-8">
 <div className="space-y-4">
 <div className="w-1/3 h-6 bg-[var(--neu-bg)] rounded"></div>
 <div className="grid grid-cols-2 gap-6">
 <div className="h-10 bg-[var(--neu-bg)] rounded"></div>
 <div className="h-10 bg-[var(--neu-bg)] rounded"></div>
 </div>
 <div className="grid grid-cols-2 gap-6">
 <div className="h-10 bg-[var(--neu-bg)] rounded"></div>
 <div className="h-10 bg-[var(--neu-bg)] rounded"></div>
 </div>
 </div>
 <div className="space-y-4">
 <div className="w-1/3 h-6 bg-[var(--neu-bg)] rounded"></div>
 <div className="h-24 bg-[var(--neu-bg)] rounded"></div>
 <div className="h-40 bg-[var(--neu-bg)] rounded"></div>
 </div>
 </div>
 </div>
 );
 }

 const brandOptions = brandsData ? brandsData.map((b: any) => ({ id: b.id, name: b.name })) : [];

 return (
 <div className="space-y-6 pb-24">
 {/* Header */}
 <div className="flex items-center justify-between sticky top-0 z-10 bg-[#1A1C23]/90 backdrop-blur-md py-4 shadow-[var(--neu-outer)] mb-8">
 <div>
 <h1 className="page-title">{isEditing ? 'Edit Product' : 'New Product'}</h1>
 <p className="text-sm text-[var(--neu-text)] mt-1 font-mono">
 {isEditing && formData.sku ? `sku: ${formData.sku}` : 'Fill in product details below.'}
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate('/catalog/products')}
 className="btn-secondary"
 >
 Cancel
 </button>
 <button
 onClick={() => saveMutation.mutate()}
 disabled={saveMutation.isPending || !formData.name || !formData.category_id || formData.price <= 0}
 className="btn-primary"
 >
 {saveMutation.isPending ? 'Saving...' : 'Save Product'}
 </button>
 </div>
 </div>

 <div className="glass-card rounded-2xl p-8 space-y-12">
 
 {/* 1. BASIC INFO */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">Basic Information</h2>
 </div>
 
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className={labelCls}>Product Name *</label>
 <input
 type="text"
 required
 value={formData.name}
 onChange={(e) => setVal('name', e.target.value)}
 className={inputCls}
 placeholder="e.g. Wireless Mouse"
 />
 </div>
 <div>
 <label className={labelCls}>SKU</label>
 <input
 type="text"
 value={formData.sku}
 onChange={(e) => setVal('sku', e.target.value)}
 className={inputCls}
 placeholder="Leave empty to auto-generate"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className={labelCls}>Category *</label>
 <CategorySelect
 id="product-category"
 value={formData.category_id}
 onChange={v => setVal('category_id', v)}
 placeholder="Select Category"
 />
 </div>
 <div>
 <label className={labelCls}>Brand</label>
 <SearchableSelect
 options={[{ id: '', name: 'No Brand' }, ...brandOptions]}
 value={formData.brand_id}
 onChange={(v) => setVal('brand_id', v)}
 placeholder="Select Brand"
 />
 </div>
 </div>

 <div>
 <label className={labelCls}>Status</label>
 <select
 value={formData.status}
 onChange={(e) => setVal('status', e.target.value)}
 className={`${inputCls} max-w-xs`}
 >
 <option value="published">Published</option>
 <option value="draft">Draft</option>
 <option value="archived">Archived</option>
 </select>
 </div>
 </div>

 {/* 2. DESCRIPTION */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">Description</h2>
 </div>
 
 <div>
 <label className={labelCls}>
 Short Description
 <span className="text-xs text-[var(--neu-text)] ml-2 font-normal">
 ({formData.short_description.length}/200)
 </span>
 </label>
 <textarea
 rows={3}
 minLength={10}
 maxLength={200}
 value={formData.short_description}
 onChange={(e) => setVal('short_description', e.target.value)}
 className={inputCls}
 placeholder="A brief summary for product cards..."
 />
 </div>

 <div>
 <label className={labelCls}>
 Full Description
 <span className="text-xs text-[var(--neu-text)] ml-2 font-normal">
 ({formData.description.length}/2000)
 </span>
 </label>
 <textarea
 rows={8}
 minLength={50}
 maxLength={2000}
 value={formData.description}
 onChange={(e) => setVal('description', e.target.value)}
 className={inputCls}
 placeholder="Detailed product information..."
 />
 </div>
 </div>

 {/* 3. PRICING */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">Pricing</h2>
 </div>
 
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className={labelCls}>Selling Price *</label>
 <div className="relative">
  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neu-text)]">₦</span>
  <input
  type="number"
  step="0.01"
  min="0"
  required
  value={formData.price || ''}
  onChange={(e) => setVal('price', parseFloat(e.target.value) || 0)}
  className={`${inputCls} pl-8`}
  />
  </div>
  </div>
  <div>
  <label className={labelCls}>Cost Price</label>
  <div className="relative">
  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neu-text)]">₦</span>
 <input
 type="number"
 step="0.01"
 min="0"
 value={formData.cost_price || ''}
 onChange={(e) => setVal('cost_price', parseFloat(e.target.value) || 0)}
 className={`${inputCls} pl-8`}
 />
 </div>
 </div>
 </div>
 </div>

 {/* 4. SHIPPING */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">Shipping & Logistics</h2>
 </div>
 
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className={labelCls}>Weight (kg)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={formData.weight || ''}
 onChange={(e) => setVal('weight', parseFloat(e.target.value) || 0)}
 className={inputCls}
 />
 </div>
 <div>
 <label className={labelCls}>Color</label>
 <div className="flex items-center gap-3">
 <input
 type="color"
 value={/^#[0-9A-Fa-f]{6}$/.test(formData.color || '') ? formData.color : '#e7e7e7'}
 onChange={(e) => setVal('color', e.target.value)}
 className="w-10 h-10 p-1 rounded bg-[var(--neu-bg)] shadow-[var(--neu-inner)] cursor-pointer border-none outline-none"
 />
 <input
 type="text"
 value={formData.color}
 onChange={(e) => setVal('color', e.target.value)}
 className={inputCls}
 placeholder="#e7e7e7"
 />
 </div>
 </div>
 </div>

 <div>
 <label className={labelCls}>Dimensions (cm)</label>
 <div className="flex items-center gap-4">
 <input
 type="number"
 step="0.1"
 min="0"
 placeholder="Length"
 value={formData.dimensions_length || ''}
 onChange={(e) => setVal('dimensions_length', parseFloat(e.target.value) || 0)}
 className={inputCls}
 />
 <span className="text-[var(--neu-text)]">×</span>
 <input
 type="number"
 step="0.1"
 min="0"
 placeholder="Width"
 value={formData.dimensions_width || ''}
 onChange={(e) => setVal('dimensions_width', parseFloat(e.target.value) || 0)}
 className={inputCls}
 />
 <span className="text-[var(--neu-text)]">×</span>
 <input
 type="number"
 step="0.1"
 min="0"
 placeholder="Height"
 value={formData.dimensions_height || ''}
 onChange={(e) => setVal('dimensions_height', parseFloat(e.target.value) || 0)}
 className={inputCls}
 />
 </div>
 </div>
 </div>

 {/* 5. MEDIA */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">Media Gallery</h2>
 </div>
 
 <p className="text-sm text-[var(--neu-text)] mb-4">
 Upload up to 5 images for the product. Select the primary image using the star icon.
 </p>
 <div>
 <GalleryManager
 productId={id || ''}
 images={formData.image_gallery}
 primaryImageUrl={formData.primary_image_url}
 onChange={(images, primaryUrl) => {
 setFormData(prev => ({
 ...prev,
 image_gallery: images,
 ...(primaryUrl !== undefined ? { primary_image_url: primaryUrl, thumbnail_url: primaryUrl } : {})
 }));
 }}
 />
 </div>
 </div>

 {/* 6. SEO */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">SEO & Search</h2>
 </div>
 
 <div>
 <label className={labelCls}>Meta Title</label>
 <input
 type="text"
 maxLength={60}
 value={formData.meta_title}
 onChange={(e) => setVal('meta_title', e.target.value)}
 className={inputCls}
 />
 </div>

 <div>
 <label className={labelCls}>Meta Description</label>
 <textarea
 rows={3}
 maxLength={160}
 value={formData.meta_description}
 onChange={(e) => setVal('meta_description', e.target.value)}
 className={inputCls}
 />
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className={labelCls}>Meta Keywords (comma-separated)</label>
 <input
 type="text"
 value={formData.meta_keywords}
 onChange={(e) => setVal('meta_keywords', e.target.value)}
 className={inputCls}
 placeholder="electronics, wireless"
 />
 </div>
 <div>
 <label className={labelCls}>Tags (comma-separated)</label>
 <input
 type="text"
 value={formData.tags}
 onChange={(e) => setVal('tags', e.target.value)}
 className={inputCls}
 placeholder="new, trending, summer"
 />
 </div>
 </div>
 </div>

 {/* 7. ATTRIBUTES */}
 <div className="space-y-6">
 <div className="pb-2 mb-6">
 <h2 className="text-lg font-bold text-white">Category Attributes</h2>
 </div>
 
 {!formData.category_id ? (
 <div className="text-center py-12 text-[var(--neu-text)]">
 Please select a Category in Basic Info first.
 </div>
 ) : attributesLoading ? (
 <div className="animate-pulse space-y-4">
 <div className="h-4 bg-white/10 rounded w-1/4"></div>
 <div className="h-10 bg-white/10 rounded w-full"></div>
 </div>
 ) : attributesData?.length === 0 ? (
 <div className="text-center py-12 text-[var(--neu-text)] rounded-xl shadow-[var(--neu-inner)]">
 No attributes defined for this category.
 </div>
 ) : (
 <div className="grid grid-cols-2 gap-6">
 {attributesData?.map((attr: any) => (
 <div key={attr.id} className="space-y-2">
 <label className={labelCls}>
 {attr.attribute_name} {attr.is_required && '*'}
 {attr.unit && <span className="normal-case font-normal ml-1 text-[10px]">({attr.unit})</span>}
 </label>
 
 {attr.attribute_type === 'enum' ? (
 <select
 required={attr.is_required}
 value={formData.attributes[attr.attribute_name] || ''}
 onChange={(e) => setAttribute(attr.attribute_name, e.target.value)}
 className={inputCls}
 >
 <option value="">Select...</option>
 {attr.allowed_values?.map((val: string) => (
 <option key={val} value={val}>{val}</option>
 ))}
 </select>
 ) : attr.attribute_type === 'boolean' ? (
 <div className="flex items-center h-[42px]">
 <label className="flex items-center gap-3 cursor-pointer">
 <input
 type="checkbox"
 checked={Boolean(formData.attributes[attr.attribute_name])}
 onChange={e => setAttribute(attr.attribute_name, e.target.checked)}
 className="w-4 h-4 accent-[var(--neu-accent)] cursor-pointer"
 />
 <span className="text-sm text-white">Yes</span>
 </label>
 </div>
 ) : attr.attribute_type === 'number' ? (
 <input
 type="number"
 required={attr.is_required}
 value={formData.attributes[attr.attribute_name] ?? ''}
 onChange={(e) => setAttribute(attr.attribute_name, parseFloat(e.target.value))}
 className={inputCls}
 />
 ) : (
 <input
 type="text"
 required={attr.is_required}
 value={formData.attributes[attr.attribute_name] || ''}
 onChange={(e) => setAttribute(attr.attribute_name, e.target.value)}
 className={inputCls}
 />
 )}
 </div>
 ))}
 </div>
 )}
 </div>

  {/* 8. RELATED PRODUCTS */}
  <div className="space-y-6">
  <div className="pb-2 mb-6">
  <h2 className="text-lg font-bold text-white">Related Products</h2>
  </div>
  
  {!isEditing ? (
  <RelatedProductsManager 
  relatedIds={formData.related_product_ids} 
  onChange={(ids) => setVal('related_product_ids', ids)} 
  />
  ) : (
  <RelatedProductsManager productId={id} />
  )}
  </div>

  {/* 9. VARIANTS */}
  <div className="space-y-6">
  <div className="pb-2 mb-6">
  <h2 className="text-lg font-bold text-white">Product Variants</h2>
  </div>
  <VariantManager
  productId={id}
  variants={formData.variants}
  onChange={(variants) => setVal('variants', variants)}
  />
  </div>

  </div>
 </div>
 );
}