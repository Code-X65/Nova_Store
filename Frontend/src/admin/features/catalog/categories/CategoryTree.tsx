import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
 ChevronRightIcon,
 ChevronDownIcon,
 PlusIcon,
 PencilIcon,
 TrashIcon,
 StarIcon,
 TagIcon,
 ArrowUpIcon,
 ArrowDownIcon,
 SwatchIcon
} from '@heroicons/react/24/outline';
import type { CategoryNode } from './useCategoryTree';

interface CategoryTreeProps {
 nodes: CategoryNode[];
 onEdit: (cat: CategoryNode) => void;
 onAddChild: (parentId: string) => void;
 onDelete: (cat: CategoryNode) => void;
 onSelect?: (cat: CategoryNode) => void;
 onMove?: (cat: CategoryNode, direction: 'up' | 'down', siblings: CategoryNode[]) => void;
 selectedId?: string;
}

interface NodeRowProps extends Omit<CategoryTreeProps, 'nodes'> {
 node: CategoryNode;
 siblings: CategoryNode[];
 depth: number;
}

function NodeRow({ node, siblings, depth, onEdit, onAddChild, onDelete, onSelect, onMove, selectedId }: NodeRowProps) {
 const [expanded, setExpanded] = useState(depth === 0);
 const [imgError, setImgError] = useState(false);
 const hasChildren = node.children?.length > 0;
 const isSelected = selectedId === node.id;

 return (
 <li>
 <div
 className={`
 group relative flex items-center gap-3 py-4 px-4 cursor-pointer
 transition-all duration-200 border-b border-[#1a1a1a] last:border-0
 ${isSelected 
 ? 'bg-[#111111]' 
 : 'bg-transparent hover:bg-[#111111]'}
 ${!node.is_active ? 'opacity-60 grayscale' : ''}
 `}
 style={{ marginLeft: `${depth > 0 ? depth * 24 : 0}px` }}
 onClick={() => onSelect?.(node)}
 >
 {/* Expand toggle */}
 <button
 onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
 className={`w-5 h-5 flex items-center justify-center flex-shrink-0 text-[var(--neu-text)]
 hover:text-white rounded transition-colors ${!hasChildren ? 'invisible' : ''}`}
 aria-label={expanded ? 'Collapse' : 'Expand'}
 >
 {expanded
 ? <ChevronDownIcon className="w-3.5 h-3.5" />
 : <ChevronRightIcon className="w-3.5 h-3.5" />}
 </button>

 {/* Color dot / icon / image */}
 {node.thumbnail_url && !imgError ? (
 <img
 src={node.thumbnail_url}
 alt={node.name}
 className="w-6 h-6 flex-shrink-0 object-cover bg-transparent mx-0.5"
 onError={() => setImgError(true)}
 />
 ) : node.color ? (
 <span
 className="w-3 h-3 rounded-full flex-shrink-0 border mx-1.5"
 style={{ backgroundColor: node.color }}
 />
 ) : (
 <TagIcon className="w-3.5 h-3.5 flex-shrink-0 text-[var(--neu-text)] mx-1.5" />
 )}

 {/* Name + meta */}
 <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium text-white truncate">{node.name}</span>
 <span className="text-xs text-[var(--neu-text)] font-mono truncate hidden sm:inline">/{node.slug}</span>

 {/* Badges */}
 <div className="flex items-center gap-1 ml-auto flex-shrink-0">
 {node.is_featured && (
 <span className="badge-nova py-0 px-1.5 text-[10px] flex items-center gap-0.5">
 <StarIcon className="w-2.5 h-2.5" /> Featured
 </span>
 )}
 {!node.is_active && (
 <span className="badge-muted py-0 px-1.5 text-[10px]">Inactive</span>
 )}
 {node.product_count > 0 && (
 <Link 
 to={`/catalog/products?category_id=${node.id}`} 
 onClick={e => e.stopPropagation()}
 className="badge py-0 px-1.5 text-[10px] text-blue-400 hover:bg-blue-400/20 cursor-pointer transition-colors"
 title="View Products"
 >
 {node.product_count} products
 </Link>
 )}
 {node.level > 0 && (
 <span className="badge-info py-0 px-1.5 text-[10px]">L{node.level}</span>
 )}
 </div>
 </div>

 {/* Actions — visible on hover */}
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
 {onMove && (
 <>
 <button
 onClick={(e) => { e.stopPropagation(); onMove(node, 'up', siblings); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
 title="Move Up"
 disabled={siblings[0]?.id === node.id}
 >
 <ArrowUpIcon className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onMove(node, 'down', siblings); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
 title="Move Down"
 disabled={siblings[siblings.length - 1]?.id === node.id}
 >
 <ArrowDownIcon className="w-3.5 h-3.5" />
 </button>
 <div className="w-px h-4 bg-[var(--panel-border)] mx-1" />
 </>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-[var(--neu-accent)] hover:bg-[var(--neu-accent)]/10 rounded-lg transition-colors"
 title="Add child category"
 >
 <PlusIcon className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onSelect?.(node); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-[var(--neu-accent)] hover:bg-white/10 rounded-lg transition-colors"
 title="Manage Attributes"
 >
 <SwatchIcon className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onEdit(node); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
 title="Edit category"
 >
 <PencilIcon className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onDelete(node); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
 title="Delete category"
 >
 <TrashIcon className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* Children */}
 {hasChildren && expanded && (
 <ul className="relative before:absolute before:-left-px before:top-6 before:bottom-6 before:w-px before:bg-gradient-to-b before:from-white/10 before:via-white/10 before:to-transparent pl-5 animate-in slide-in-from-top-2 fade-in duration-300">
 {node.children.map(child => (
 <NodeRow
 key={child.id}
 node={child}
 siblings={node.children}
 depth={depth + 1}
 onEdit={onEdit}
 onAddChild={onAddChild}
 onDelete={onDelete}
 onSelect={onSelect}
 onMove={onMove}
 selectedId={selectedId}
 />
 ))}
 </ul>
 )}
 </li>
 );
}

/** Skeleton loader row */
function SkeletonRow({ depth = 0 }: { depth?: number }) {
 return (
 <div
 className="flex items-center gap-3 py-4 px-4 animate-pulse border-b border-[#1a1a1a]"
 style={{ paddingLeft: `${depth * 20 + 16}px` }}
 >
 <div className="w-4 h-4 rounded bg-white/5 flex-shrink-0" />
 <div className="w-3 h-3 rounded-full bg-white/5 flex-shrink-0" />
 <div className="flex-1 h-3.5 bg-white/5 rounded-full" />
 <div className="w-16 h-4 bg-white/5 rounded-full" />
 </div>
 );
}

export function CategoryTreeSkeleton() {
 return (
 <div className="space-y-1 p-2">
 {[0, 0, 1, 1, 2, 0, 1].map((d, i) => <SkeletonRow key={i} depth={d} />)}
 </div>
 );
}

export function CategoryTree({ nodes, onEdit, onAddChild, onDelete, onSelect, onMove, selectedId }: CategoryTreeProps) {
 if (!nodes) {
 return (
 <div className="space-y-1 p-2">
 {[0, 0, 1, 1, 2, 0, 1].map((d, i) => <SkeletonRow key={i} depth={d} />)}
 </div>
 );
 }

 if (nodes.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <TagIcon className="w-10 h-10 text-[var(--neu-text)] mb-3 opacity-40" />
 <p className="text-sm font-medium text-white">No categories yet</p>
 <p className="text-xs text-[var(--neu-text)] mt-1">Create your first root category to get started.</p>
 </div>
 );
 }

 return (
 <ul className="flex flex-col">
 {nodes.map(node => (
 <NodeRow
 key={node.id}
 node={node}
 siblings={nodes}
 depth={0}
 onEdit={onEdit}
 onAddChild={onAddChild}
 onDelete={onDelete}
 onSelect={onSelect}
 onMove={onMove}
 selectedId={selectedId}
 />
 ))}
 </ul>
 );
}
