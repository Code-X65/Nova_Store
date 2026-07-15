import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createCategoryAttribute, updateCategoryAttribute } from '../api/attributes';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

export interface AttributeTemplate {
 id: string;
 category_id: string;
 attribute_name: string;
 attribute_type: 'text' | 'number' | 'boolean' | 'enum';
 is_required: boolean;
 unit: string | null;
 allowed_values: string[] | null;
 display_order: number;
 created_at: string;
 updated_at: string;
 /** Injected client-side — name of the ancestor category if inherited */
 inherited_from?: string | null;
}

interface AttributeFormProps {
 categoryId: string;
 /** If provided, form is in edit mode for this attribute */
 editing?: AttributeTemplate | null;
 onClose: () => void;
}

interface FormState {
 attribute_name: string;
 attribute_type: 'text' | 'number' | 'boolean' | 'enum';
 is_required: boolean;
 unit: string;
 display_order: number;
 allowed_values: string[];
 _enumInput: string; // staging input for adding enum values
}

const empty: FormState = {
 attribute_name: '',
 attribute_type: 'text',
 is_required: false,
 unit: '',
 display_order: 0,
 allowed_values: [],
 _enumInput: '',
};

const TYPE_OPTIONS: { value: FormState['attribute_type']; label: string; colour: string }[] = [
 { value: 'text', label: 'Text', colour: 'text-[var(--neu-text)]' },
 { value: 'number', label: 'Number', colour: 'text-blue-400' },
 { value: 'boolean', label: 'Boolean', colour: 'text-emerald-400' },
 { value: 'enum', label: 'Enum', colour: 'text-[var(--neu-accent)]' },
];

export function AttributeForm({ categoryId, editing, onClose }: AttributeFormProps) {
 const qc = useQueryClient();
 const isEditing = Boolean(editing);
 const enumInputRef = useRef<HTMLInputElement>(null);

 const [form, setForm] = useState<FormState>(empty);
 const [conflictError, setConflictError] = useState('');

 useEffect(() => {
 if (editing) {
 setForm({
 attribute_name: editing.attribute_name,
 attribute_type: editing.attribute_type,
 is_required: editing.is_required,
 unit: editing.unit ?? '',
 display_order: editing.display_order,
 allowed_values: editing.allowed_values ?? [],
 _enumInput: '',
 });
 } else {
 setForm(empty);
 }
 setConflictError('');
 }, [editing]);

 const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
 setForm(prev => ({ ...prev, [key]: val }));
 }, []);

 const addEnumValue = () => {
 const v = form._enumInput.trim();
 if (!v || form.allowed_values.includes(v)) return;
 set('allowed_values', [...form.allowed_values, v]);
 set('_enumInput', '');
 enumInputRef.current?.focus();
 };

 const removeEnumValue = (val: string) => {
 set('allowed_values', form.allowed_values.filter(v => v !== val));
 };

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = {
 attribute_name: form.attribute_name.trim(),
 attribute_type: form.attribute_type,
 is_required: form.is_required,
 unit: form.unit.trim() || null,
 display_order: form.display_order,
 allowed_values: form.attribute_type === 'enum' ? form.allowed_values : null,
 };
 if (isEditing && editing) {
 return updateCategoryAttribute(editing.id, payload);
 }
 return createCategoryAttribute(categoryId, payload);
 },
 onSuccess: () => {
 toast.success(isEditing ? 'Attribute updated' : 'Attribute created');
 qc.invalidateQueries({ queryKey: ['attributes', categoryId] });
 onClose();
 },
 onError: (err: any) => {
 if (err?.response?.status === 409) {
 setConflictError(`An attribute named"${form.attribute_name}" already exists for this category.`);
 } else {
 toast.error(err?.response?.data?.message ?? 'Failed to save attribute');
 }
 },
 });

 const inputCls = 'input text-sm py-2 px-3 rounded-lg';
 const labelCls = 'block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-1.5';

 const isEnumValid = form.attribute_type !== 'enum' || form.allowed_values.length > 0;

 return (
 <div className="glass-card border border-[var(--panel-border)] rounded-2xl p-5 space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-bold text-white">
 {isEditing ? 'Edit Attribute' : 'New Attribute'}
 </h3>
 <button
 type="button"
 onClick={onClose}
 className="p-1.5 text-[var(--neu-text)] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
 >
 <XMarkIcon className="w-4 h-4" />
 </button>
 </div>

 <form
 id="attr-form"
 onSubmit={e => { e.preventDefault(); if (isEnumValid) saveMutation.mutate(); }}
 className="space-y-4"
 >
 {/* Name + Type */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={labelCls}>Name *</label>
 <input
 type="text"
 required
 minLength={1}
 maxLength={100}
 value={form.attribute_name}
 onChange={e => { set('attribute_name', e.target.value); setConflictError(''); }}
 className={inputCls}
 placeholder="e.g. RAM"
 />
 {conflictError && (
 <p className="mt-1 text-[10px] text-red-400">{conflictError}</p>
 )}
 </div>
 <div>
 <label className={labelCls}>Type</label>
 <select
 value={form.attribute_type}
 onChange={e => {
 const t = e.target.value as FormState['attribute_type'];
 set('attribute_type', t);
 if (t !== 'enum') set('allowed_values', []);
 }}
 className={inputCls}
 >
 {TYPE_OPTIONS.map(o => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Enum allowed values */}
 {form.attribute_type === 'enum' && (
 <div>
 <label className={labelCls}>
 Allowed Values * <span className="normal-case font-normal text-[var(--neu-text)]">(at least one required)</span>
 </label>
 <div className="flex gap-2 mb-2">
 <input
 ref={enumInputRef}
 type="text"
 value={form._enumInput}
 onChange={e => set('_enumInput', e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEnumValue(); } }}
 className={`${inputCls} flex-1`}
 placeholder="Type a value and press Enter…"
 />
 <button
 type="button"
 onClick={addEnumValue}
 disabled={!form._enumInput.trim()}
 className="btn-primary px-3 py-2 text-xs disabled:opacity-40"
 >
 <PlusIcon className="w-3.5 h-3.5" />
 </button>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {form.allowed_values.map(v => (
 <span
 key={v}
 className="inline-flex items-center gap-1 badge-nova py-0.5 px-2 text-xs"
 >
 {v}
 <button
 type="button"
 onClick={() => removeEnumValue(v)}
 className="hover:text-white ml-0.5 leading-none"
 aria-label={`Remove ${v}`}
 >
 ×
 </button>
 </span>
 ))}
 {form.allowed_values.length === 0 && (
 <p className="text-xs text-red-400">Add at least one allowed value.</p>
 )}
 </div>
 </div>
 )}

 {/* Unit + Order */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={labelCls}>Unit <span className="normal-case font-normal">(optional, ≤50)</span></label>
 <input
 type="text"
 maxLength={50}
 value={form.unit}
 onChange={e => set('unit', e.target.value)}
 className={inputCls}
 placeholder="GB, kg, px…"
 />
 </div>
 <div>
 <label className={labelCls}>Display Order</label>
 <input
 type="number"
 min={0}
 value={form.display_order}
 onChange={e => set('display_order', parseInt(e.target.value) || 0)}
 className={`${inputCls} w-full`}
 />
 </div>
 </div>

 {/* Required toggle */}
 <label className="flex items-center gap-3 cursor-pointer">
 <input
 type="checkbox"
 checked={form.is_required}
 onChange={e => set('is_required', e.target.checked)}
 className="w-4 h-4 accent-[var(--neu-accent)] cursor-pointer"
 />
 <span className="text-sm text-white">Required on products</span>
 </label>
 </form>

 {/* Footer */}
 <div className="flex justify-end gap-2 pt-1 border-t border-[var(--panel-border)]">
 <button type="button" onClick={onClose} className="btn-secondary text-xs px-4 py-2">
 Cancel
 </button>
 <button
 type="submit"
 form="attr-form"
 disabled={saveMutation.isPending || !form.attribute_name.trim() || !isEnumValid}
 className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
 >
 {saveMutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Attribute'}
 </button>
 </div>
 </div>
 );
}
