import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCategoryAttributes } from '../api/attributes';
import {
 PlusIcon,
 PencilIcon,
 TrashIcon,
 LockClosedIcon,
 XMarkIcon,
 SwatchIcon,
} from '@heroicons/react/24/outline';
import { AttributeForm, type AttributeTemplate } from './AttributeForm';
import { DeleteAttributeModal } from './DeleteAttributeModal';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

const attributeColumnHelper = createColumnHelper<AttributeTemplate>();

interface AttributeManagerProps {
 categoryId: string;
 categoryName: string;
 onClose: () => void;
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
 text: { label: 'Text', cls: 'badge-muted' },
 number: { label: 'Number', cls: 'badge-info' },
 boolean: { label: 'Boolean', cls: 'badge-success' },
 enum: { label: 'Enum', cls: 'badge-nova' },
};

function SkeletonRow() {
 return (
 <tr className="animate-pulse">
 {[40, 16, 16, 24, 48, 20, 24].map((w, i) => (
 <td key={i} className="px-4 py-3">
 <div className={`h-3.5 bg-white/5 rounded-full`} style={{ width: `${w * 3}px` }} />
 </td>
 ))}
 </tr>
 );
}

export function AttributeManager({ categoryId, categoryName, onClose }: AttributeManagerProps) {
 const [showForm, setShowForm] = useState(false);
 const [editingAttr, setEditingAttr] = useState<AttributeTemplate | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<AttributeTemplate | null>(null);

 const { data: attrs = [], isLoading } = useQuery<AttributeTemplate[]>({
 queryKey: ['attributes', categoryId],
 queryFn: async () => {
 return fetchCategoryAttributes(categoryId);
 },
 staleTime: 15_000,
 enabled: Boolean(categoryId),
 });

 const own = attrs.filter(a => a.category_id === categoryId);
 const inherited = attrs.filter(a => a.category_id !== categoryId);

 const handleEdit = (attr: AttributeTemplate) => {
 setEditingAttr(attr);
 setShowForm(true);
 };

 const handleFormClose = () => {
 setShowForm(false);
 setEditingAttr(null);
 };

 return (
 <div className="fixed inset-0 z-40 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

 {/* Drawer panel */}
 <div className="relative z-50 w-full max-w-2xl h-full bg-[var(--panel-bg)] border-l border-[var(--panel-border)] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
 {/* Panel header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--panel-border)] flex-shrink-0">
 <div className="flex items-center gap-3 min-w-0">
 <SwatchIcon className="w-4 h-4 text-[var(--neu-accent)] flex-shrink-0" />
 <div className="min-w-0">
 <p className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Attribute Templates</p>
 <p className="text-sm font-bold text-white truncate">{categoryName}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 {!showForm && (
 <button
 onClick={() => { setEditingAttr(null); setShowForm(true); }}
 className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
 >
 <PlusIcon className="w-3.5 h-3.5" />
 Add
 </button>
 )}
 <button
 onClick={onClose}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
 >
 <XMarkIcon className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Scrollable body */}
 <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
 {/* Inline form */}
 {showForm && (
 <AttributeForm
 categoryId={categoryId}
 editing={editingAttr}
 onClose={handleFormClose}
 />
 )}

 {/* Own attributes */}
 <div>
 <div className="flex items-center gap-2 mb-2">
 <p className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-widest">
 Own ({own.length})
 </p>
 </div>

 {isLoading ? (
 <div className="table-wrapper">
 <table className="table w-full">
 <tbody>{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</tbody>
 </table>
 </div>
 ) : own.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-[var(--panel-border)] rounded-2xl">
 <SwatchIcon className="w-8 h-8 text-[var(--neu-text)] opacity-30 mb-2" />
 <p className="text-sm text-[var(--neu-text)]">No own attributes yet.</p>
 <p className="text-xs text-[var(--neu-text)] opacity-60 mt-0.5 mb-4">Create your first template to get started.</p>
 {!showForm && (
 <button
 onClick={() => { setEditingAttr(null); setShowForm(true); }}
 className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2"
 >
 <PlusIcon className="w-4 h-4" />
 Add Attribute
 </button>
 )}
 </div>
 ) : (
 <AttributeTable
 attributes={own}
 categoryId={categoryId}
 onEdit={handleEdit}
 onDelete={setDeleteTarget}
 isOwn
 />
 )}
 </div>

 {/* Inherited attributes */}
 {inherited.length > 0 && (
 <div>
 <p className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-widest mb-2">
 Inherited ({inherited.length})
 </p>
 <AttributeTable
 attributes={inherited}
 categoryId={categoryId}
 onEdit={() => {}}
 onDelete={() => {}}
 isOwn={false}
 />
 </div>
 )}
 </div>

 {/* Delete Modal */}
 {deleteTarget && (
 <DeleteAttributeModal
 attribute={deleteTarget}
 categoryId={categoryId}
 onClose={() => setDeleteTarget(null)}
 />
 )}
 </div>
 </div>
 );
}

interface AttributeTableProps {
 attributes: AttributeTemplate[];
 categoryId: string;
 onEdit: (attr: AttributeTemplate) => void;
 onDelete: (attr: AttributeTemplate) => void;
 isOwn: boolean;
}

function AttributeTable({ attributes, onEdit, onDelete, isOwn }: AttributeTableProps) {
 const sorted = [...attributes].sort((a, b) => a.display_order - b.display_order || a.attribute_name.localeCompare(b.attribute_name));

 const columns = useMemo(() => {
 const base = [
 attributeColumnHelper.accessor('attribute_name', {
 header: 'Name',
 cell: (info) => (
 <span className="font-semibold text-white max-w-[120px] truncate block">{info.getValue()}</span>
 ),
 }),
 attributeColumnHelper.accessor('attribute_type', {
 header: 'Type',
 cell: (info) => {
 const tm = TYPE_META[info.getValue()] ?? TYPE_META.text;
 return <span className={`${tm.cls} py-0 px-1.5 text-[10px]`}>{tm.label}</span>;
 },
 }),
 attributeColumnHelper.accessor('is_required', {
 header: 'Req.',
 cell: (info) => (
 info.getValue()
 ? <LockClosedIcon className="w-3 h-3 text-[var(--neu-accent)]" />
 : <span className="text-[var(--neu-text)]">–</span>
 ),
 }),
 attributeColumnHelper.accessor('unit', {
 header: 'Unit',
 cell: (info) => (
 info.getValue() ? <span className="text-[var(--neu-text)]">{info.getValue()}</span> : <span className="opacity-30">–</span>
 ),
 }),
 attributeColumnHelper.display({
 id: 'values',
 header: 'Values',
 cell: (info) => {
 const attr = info.row.original;
 return attr.attribute_type === 'enum' && attr.allowed_values?.length ? (
 <div className="flex flex-wrap gap-1 max-w-[140px]">
 {attr.allowed_values.slice(0, 3).map(v => (
 <span key={v} className="badge-muted py-0 px-1.5 text-[9px]">{v}</span>
 ))}
 {attr.allowed_values.length > 3 && (
 <span className="badge-muted py-0 px-1.5 text-[9px]">+{attr.allowed_values.length - 3}</span>
 )}
 </div>
 ) : (
 <span className="text-[var(--neu-text)] opacity-30">–</span>
 );
 },
 }),
 ];

 if (!isOwn) {
 base.push(
 attributeColumnHelper.display({
 id: 'inherited_from',
 header: 'From',
 cell: (info) => (
 <span className="badge-muted py-0 px-1.5 text-[9px] max-w-[80px] truncate">
 {info.row.original.inherited_from ?? 'Ancestor'}
 </span>
 ),
 })
 );
 }

 if (isOwn) {
 base.push(
 attributeColumnHelper.display({
 id: 'actions',
 header: '',
 cell: (info) => {
 const attr = info.row.original;
 return (
 <div className="flex items-center justify-end gap-1">
 <button
 onClick={(e) => { e.stopPropagation(); onEdit(attr); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
 title="Edit attribute"
 >
 <PencilIcon className="w-3 h-3" />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onDelete(attr); }}
 className="p-1.5 text-[var(--neu-text)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
 title="Delete attribute"
 >
 <TrashIcon className="w-3 h-3" />
 </button>
 </div>
 );
 },
 })
 );
 }

 return base;
 }, [isOwn, onEdit, onDelete]);

 return (
 <div className={`table-wrapper overflow-x-auto ${!isOwn ? 'opacity-60' : ''}`}>
 <DataTable columns={columns} data={sorted} disablePagination />
 </div>
 );
}
