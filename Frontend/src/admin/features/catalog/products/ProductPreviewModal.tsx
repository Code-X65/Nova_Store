import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, CubeIcon } from '@heroicons/react/24/outline';

interface ProductPreviewModalProps {
 isOpen: boolean;
 onClose: () => void;
 product: any;
}

export function ProductPreviewModal({ isOpen, onClose, product }: ProductPreviewModalProps) {
 if (!product) return null;

 return (
 <Transition appear show={isOpen} as={Fragment}>
 <Dialog as="div" className="relative z-50" onClose={onClose}>
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-300"
 enterFrom="opacity-0"
 enterTo="opacity-100"
 leave="ease-in duration-200"
 leaveFrom="opacity-100"
 leaveTo="opacity-0"
 >
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
 </Transition.Child>

 <div className="fixed inset-0 overflow-y-auto">
 <div className="flex min-h-full items-center justify-center p-4 text-center">
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-300"
 enterFrom="opacity-0 scale-95"
 enterTo="opacity-100 scale-100"
 leave="ease-in duration-200"
 leaveFrom="opacity-100 scale-100"
 leaveTo="opacity-0 scale-95"
 >
 <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] p-6 text-left align-middle shadow-xl transition-all">
 <div className="flex items-center justify-between mb-6">
 <Dialog.Title as="h3" className="text-xl font-bold text-white">
 Product Preview
 </Dialog.Title>
 <button
 onClick={onClose}
 className="p-2 text-[var(--neu-text)] hover:text-white transition-colors rounded-lg hover:bg-white/10"
 >
 <XMarkIcon className="w-6 h-6" />
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {/* Left: Images */}
 <div className="space-y-4">
 <div className="aspect-square rounded-xl bg-surface-2 border border-[var(--panel-border)] overflow-hidden flex items-center justify-center">
 {product.primary_image_url || product.thumbnail_url ? (
 <img 
 src={product.primary_image_url || product.thumbnail_url} 
 alt={product.name}
 className="w-full h-full object-cover"
 />
 ) : (
 <CubeIcon className="w-16 h-16 text-[var(--neu-text)] opacity-30" />
 )}
 </div>
 {product.image_gallery && product.image_gallery.length > 0 && (
 <div className="grid grid-cols-4 gap-2">
 {product.image_gallery.slice(0, 4).map((url: string, idx: number) => (
 <div key={idx} className="aspect-square rounded-lg border border-[var(--panel-border)] overflow-hidden">
 <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Right: Details */}
 <div className="space-y-6">
 <div>
 <h2 className="text-2xl font-bold text-white">{product.name}</h2>
 <p className="text-sm text-[var(--neu-text)] font-mono mt-1">SKU: {product.sku}</p>
 </div>

 <div className="flex items-center gap-3">
  <span className="text-2xl font-bold text-emerald-400">
  ₦{Number(product.price).toFixed(2)}
  </span>
  {product.cost_price > 0 && (
  <span className="text-sm font-medium text-[var(--neu-text)]" title="Cost Price">
  (Cost: ₦{Number(product.cost_price).toFixed(2)})
  </span>
  )}
 {product.status === 'published' && (
 <span className="badge-success">Published</span>
 )}
 {product.status === 'draft' && (
 <span className="badge-muted">Draft</span>
 )}
 </div>

 <div className="space-y-2">
 <h4 className="text-sm font-bold text-white tracking-wider uppercase">Description</h4>
 <p className="text-sm text-[var(--neu-text)] leading-relaxed">
 {product.short_description || product.description || 'No description provided.'}
 </p>
 </div>

 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--panel-border)]">
 <div>
 <span className="block text-xs text-[var(--neu-text)] uppercase tracking-wider mb-1">Category</span>
 <span className="text-sm text-white font-medium">{product.category?.name || 'Uncategorized'}</span>
 </div>
 <div>
 <span className="block text-xs text-[var(--neu-text)] uppercase tracking-wider mb-1">Brand</span>
 <span className="text-sm text-white font-medium">{product.brand?.name || 'No Brand'}</span>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--panel-border)]">
 <div>
 <span className="block text-xs text-[var(--neu-text)] uppercase tracking-wider mb-1">Dimensions</span>
 <span className="text-sm text-white font-medium">
 {product.dimensions_length || 0} x {product.dimensions_width || 0} x {product.dimensions_height || 0}
 </span>
 </div>
 <div>
 <span className="block text-xs text-[var(--neu-text)] uppercase tracking-wider mb-1">Weight</span>
 <span className="text-sm text-white font-medium">{product.weight || 0} kg</span>
 </div>
 </div>

 {product.tags && product.tags.length > 0 && (
 <div className="pt-4 border-t border-[var(--panel-border)]">
 <span className="block text-xs text-[var(--neu-text)] uppercase tracking-wider mb-2">Tags</span>
 <div className="flex flex-wrap gap-2">
 {product.tags.map((tag: string, i: number) => (
 <span key={i} className="px-2 py-1 text-xs bg-white/5 border rounded-md text-white/70">
 {tag}
 </span>
 ))}
 </div>
 </div>
 )}

 <div className="pt-4 border-t border-[var(--panel-border)] flex justify-between">
 <span className="text-xs text-[var(--neu-text)] font-mono">
 Created: {new Date(product.created_at).toLocaleDateString()}
 </span>
 </div>
 </div>
 </div>
 </Dialog.Panel>
 </Transition.Child>
 </div>
 </div>
 </Dialog>
 </Transition>
 );
}
