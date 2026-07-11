import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import {
 ChevronDownIcon,
 ChevronRightIcon,
 DocumentPlusIcon,
 CheckCircleIcon,
 ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface SubcategoryInput {
 name: string;
 subcategories?: SubcategoryInput[];
}

interface BulkCategoryInput {
 name: string;
 parentId?: string;
 description?: string;
 subcategories?: SubcategoryInput[];
}

const EXAMPLE = JSON.stringify(
 [
 {
 name: 'Electronics',
 description: 'All electronic devices',
 subcategories: [{ name: 'Phones' }, { name: 'Laptops' }],
 },
 { name: 'Clothing' },
 ],
 null,
 2
);

function parseInput(raw: string): { parsed: BulkCategoryInput[] | null; error: string } {
 try {
 const data = JSON.parse(raw);
 if (!Array.isArray(data)) return { parsed: null, error: 'Root must be a JSON array.' };
 if (data.length === 0) return { parsed: null, error: 'Array is empty.' };
 if (data.some(d => !d.name)) return { parsed: null, error: 'Every item must have a"name" field.' };
 return { parsed: data as BulkCategoryInput[], error: '' };
 } catch (e: any) {
 return { parsed: null, error: e.message };
 }
}

function countAll(items: BulkCategoryInput[]): number {
 return items.reduce((acc, item) => {
 return acc + 1 + countAll((item.subcategories ?? []) as BulkCategoryInput[]);
 }, 0);
}

function PreviewItem({ item, depth = 0 }: { item: BulkCategoryInput; depth?: number }) {
 return (
 <li>
 <div
 className="flex items-center gap-2 py-1"
 style={{ paddingLeft: `${depth * 16 + 4}px` }}
 >
 <span className="text-[var(--neu-text)] text-xs">{'└─'.slice(depth === 0 ? 2 : 0)}</span>
 <span className="text-sm text-white font-medium">{item.name}</span>
 {item.description && (
 <span className="text-xs text-[var(--neu-text)] truncate max-w-[200px]">{item.description}</span>
 )}
 </div>
 {item.subcategories?.map((child, i) => (
 <PreviewItem key={i} item={child as BulkCategoryInput} depth={depth + 1} />
 ))}
 </li>
 );
}

interface BulkCreatePanelProps {
 onSuccess?: () => void;
}

export function BulkCreatePanel({ onSuccess }: BulkCreatePanelProps) {
 const qc = useQueryClient();
 const [open, setOpen] = useState(false);
 const [raw, setRaw] = useState('');
 const [showExample, setShowExample] = useState(false);

 const { parsed, error } = raw.trim() ? parseInput(raw) : { parsed: null, error: '' };

 const bulkMutation = useMutation({
 mutationFn: () => api.post('/categories/bulk', parsed),
 onSuccess: () => {
 toast.success(`${parsed ? countAll(parsed) : 0} categories created`);
 qc.invalidateQueries({ queryKey: ['categories', 'tree'] });
 setRaw('');
 onSuccess?.();
 },
 onError: (err: any) => {
 toast.error(err?.response?.data?.message ?? 'Bulk create failed');
 },
 });

 return (
 <div className="glass-card border border-[var(--panel-border)] rounded-2xl overflow-hidden">
 {/* Toggle header */}
 <button
 type="button"
 onClick={() => setOpen(o => !o)}
 className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/3 transition-colors"
 >
 <div className="flex items-center gap-3">
 <DocumentPlusIcon className="w-5 h-5 text-[var(--neu-accent)]" />
 <div>
 <p className="text-sm font-bold text-white">Bulk Import</p>
 <p className="text-xs text-[var(--neu-text)]">Create multiple categories at once via JSON</p>
 </div>
 </div>
 {open ? (
 <ChevronDownIcon className="w-4 h-4 text-[var(--neu-text)]" />
 ) : (
 <ChevronRightIcon className="w-4 h-4 text-[var(--neu-text)]" />
 )}
 </button>

 {open && (
 <div className="px-6 pb-6 space-y-4 border-t border-[var(--panel-border)]">
 {/* Example toggle */}
 <div className="pt-4">
 <div className="flex items-center justify-between mb-2">
 <label className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">
 JSON Payload
 </label>
 <button
 type="button"
 onClick={() => setShowExample(s => !s)}
 className="text-xs text-[var(--neu-accent)] hover:underline"
 >
 {showExample ? 'Hide' : 'Show'} example
 </button>
 </div>

 {showExample && (
 <pre className="mb-3 p-3 bg-[var(--neu-bg)] border border-[var(--panel-border)] rounded-xl text-xs text-[var(--neu-text)] overflow-x-auto whitespace-pre">
 {EXAMPLE}
 </pre>
 )}

 <textarea
 rows={8}
 value={raw}
 onChange={e => setRaw(e.target.value)}
 className="input font-mono text-xs resize-y"
 placeholder={`[\n {"name":"Electronics","subcategories": [{"name":"Phones" }] }\n]`}
 spellCheck={false}
 />
 </div>

 {/* Parse status */}
 {raw.trim() && (
 <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs border ${
 error
 ? 'bg-red-400/10 border-red-400/30 text-red-400'
 : 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
 }`}>
 {error ? (
 <>
 <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
 <span>{error}</span>
 </>
 ) : (
 <>
 <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
 <span>Valid — {parsed ? countAll(parsed) : 0} categories to create</span>
 </>
 )}
 </div>
 )}

 {/* Preview */}
 {parsed && !error && (
 <div>
 <p className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-2">Preview</p>
 <div className="max-h-48 overflow-y-auto p-3 bg-[var(--neu-bg)] border border-[var(--panel-border)] rounded-xl">
 <ul className="space-y-0.5">
 {parsed.map((item, i) => (
 <PreviewItem key={i} item={item} depth={0} />
 ))}
 </ul>
 </div>
 </div>
 )}

 <div className="flex justify-end">
 <button
 type="button"
 disabled={!parsed || !!error || bulkMutation.isPending}
 onClick={() => bulkMutation.mutate()}
 className="btn-primary text-sm px-6 py-2 disabled:opacity-40"
 >
 {bulkMutation.isPending ? 'Creating…' : `Create ${parsed ? countAll(parsed) : 0} Categories`}
 </button>
 </div>
 </div>
 )}
 </div>
 );
}
