import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { XMarkIcon, PlusIcon, StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { ImageUploadInput } from '@/admin/components/ui/ImageUploadInput';

interface GalleryManagerProps {
 productId?: string;
 images: string[];
 primaryImageUrl?: string;
 onChange: (images: string[], primaryUrl?: string) => void;
}

export function GalleryManager({ productId, images, primaryImageUrl, onChange }: GalleryManagerProps) {
 const qc = useQueryClient();
 const [newUrl, setNewUrl] = useState('');

 // Mutation for adding images directly to backend (Edit Mode)
 const addMutation = useMutation({
 mutationFn: async (urls: string[]) => {
 if (!productId) return urls; // create mode: skip backend call
 for (const url of urls) {
 await api.post(`/products/${productId}/images`, { imageUrl: url });
 }
 return urls;
 },
 onSuccess: (urls) => {
 let newImages = [...images];
 let newPrimary = primaryImageUrl;
 for (const url of urls) {
 if (newImages.length >= 5) break;
 newImages.push(url);
 if (newImages.length === 1) newPrimary = url;
 }
 onChange(newImages, newPrimary);
 setNewUrl('');
 if (productId) {
 toast.success(urls.length > 1 ? `${urls.length} images added to gallery` : 'Image added to gallery');
 qc.invalidateQueries({ queryKey: ['product', productId] });
 }
 },
 onError: (err: any) => {
 toast.error(err?.response?.data?.message || 'Failed to add image(s)');
 }
 });

 // Mutation for removing image directly from backend (Edit Mode)
 const removeMutation = useMutation({
 mutationFn: async (index: number) => {
 if (!productId) return index; // create mode
 await api.delete(`/products/${productId}/images/${index}`);
 return index;
 },
 onSuccess: (index) => {
 const copy = [...images];
 const removedUrl = copy[index];
 copy.splice(index, 1);
 
 let newPrimary = primaryImageUrl;
 if (removedUrl === primaryImageUrl) {
 newPrimary = copy.length > 0 ? copy[0] : '';
 }
 
 onChange(copy, newPrimary);
 
 if (productId) {
 toast.success('Image removed');
 qc.invalidateQueries({ queryKey: ['product', productId] });
 }
 },
 onError: (err: any) => {
 toast.error(err?.response?.data?.message || 'Failed to remove image');
 }
 });

 const handleAdd = () => {
 if (!newUrl.trim()) return;
 if (images.length >= 5) {
 toast.error('Maximum of 5 images allowed.');
 return;
 }
 addMutation.mutate([newUrl.trim()]);
 };

 const handleMultipleAdded = (urls: string[]) => {
 if (images.length >= 5) {
 toast.error('Maximum of 5 images allowed.');
 return;
 }
 addMutation.mutate(urls);
 };

 const handleSetPrimary = (url: string) => {
 onChange(images, url);
 };

 return (
 <div className="space-y-4">
 <div className="flex gap-2 items-end">
 <div className="flex-1">
 <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5">
 Add Image
 </label>
 <ImageUploadInput
 value={newUrl}
 onChange={setNewUrl}
 multiple={true}
 onChangeMultiple={handleMultipleAdded}
 placeholder="Upload or paste image URL..."
 />
 </div>
 <button
 type="button"
 onClick={handleAdd}
 disabled={!newUrl || addMutation.isPending || images.length >= 5}
 className="btn-primary h-[42px] px-4 flex items-center gap-2"
 >
 <PlusIcon className="w-4 h-4" />
 Add
 </button>
 </div>

 {images.length > 0 ? (
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
 {images.map((url, idx) => {
 const isPrimary = url === primaryImageUrl;
 return (
 <div key={`${url}-${idx}`} className={`group relative aspect-square bg-[var(--neu-bg)] shadow-[var(--neu-inner)] rounded-xl overflow-hidden ${isPrimary ? 'ring-2 ring-[var(--neu-accent)] ring-offset-2 ring-offset-[var(--panel-bg)]' : ''}`}>
 <img
 src={url}
 alt={`Gallery ${idx + 1}`}
 className="w-full h-full object-cover"
 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 
 {/* Primary badge */}
 {isPrimary && (
 <div className="absolute top-2 left-2 bg-[var(--neu-accent)] text-white text-[10px] font-bold px-2 py-1 rounded shadow-md z-10 flex items-center gap-1">
 <StarSolid className="w-3 h-3" /> PRIMARY
 </div>
 )}
 
 {/* Overlay with actions */}
 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm z-20">
 {!isPrimary && (
 <button
 type="button"
 onClick={() => handleSetPrimary(url)}
 className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/40 transition-colors"
 title="Set as Primary"
 >
 <StarOutline className="w-6 h-6" />
 </button>
 )}
 <button
 type="button"
 onClick={() => removeMutation.mutate(idx)}
 disabled={removeMutation.isPending}
 className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors"
 title="Remove Image"
 >
 <XMarkIcon className="w-6 h-6" />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-10 shadow-[var(--neu-inner)] rounded-xl text-[var(--neu-text)] text-sm">
 No gallery images added yet. Minimum of 2 required to publish.
 </div>
 )}
 </div>
 );
}
