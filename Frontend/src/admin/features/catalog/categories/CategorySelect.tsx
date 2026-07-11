import { useCategoryTree, flattenTree, collectDescendantIds, type CategoryNode } from './useCategoryTree';
import { SearchableSelect } from '@/admin/components/ui/SearchableSelect';

interface CategorySelectProps {
 value: string;
 onChange: (value: string) => void;
 /** Category id whose subtree should be excluded (prevents self-reparenting). */
 excludeSubtreeOf?: string;
 placeholder?: string;
 className?: string;
 id?: string;
}

/**
 * Indented category selector backed by the live tree.
 * Renders each option with └─ prefix matching its depth in the hierarchy.
 * Inactive categories are dimmed but still selectable.
 */
export function CategorySelect({
 value,
 onChange,
 excludeSubtreeOf,
 placeholder = 'Select category',
 className = '',
 id,
}: CategorySelectProps) {
 const { data: tree = [], isLoading } = useCategoryTree();

 // Build the exclusion set from the node's subtree (self + descendants)
 const excluded = new Set<string>();
 if (excludeSubtreeOf) {
 const findAndCollect = (nodes: CategoryNode[]): boolean => {
 for (const n of nodes) {
 if (n.id === excludeSubtreeOf) {
 collectDescendantIds(n).forEach(id => excluded.add(id));
 return true;
 }
 if (findAndCollect(n.children ?? [])) return true;
 }
 return false;
 };
 findAndCollect(tree);
 }

 const flat = flattenTree(tree).filter(c => !excluded.has(c.id));

 if (isLoading) {
 return <div className={`w-full h-[42px] rounded-lg bg-[var(--neu-bg)] shadow-[var(--neu-inner)] animate-pulse ${className}`}></div>;
 }

 const options = flat.map(cat => ({
 id: cat.id,
 name: `${cat.indent}${cat.name}`,
 }));

 return (
 <SearchableSelect
 options={options}
 value={value}
 onChange={onChange}
 placeholder={placeholder}
 />
 );
}
