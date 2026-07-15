import { useQuery } from '@tanstack/react-query';
import { fetchCategoryTree as fetchCategoryTreeApi } from '../api/categories';

export interface CategoryNode {
 id: string;
 name: string;
 slug: string;
 description?: string;
 parent_id: string | null;
 parent?: { id: string; name: string } | null;
 level: number;
 full_path: string[];
 product_count: number;
 is_active: boolean;
 is_featured: boolean;
 icon?: string;
 color?: string;
 sort_order: number;
 image_url?: string;
 thumbnail_url?: string;
 meta_title?: string;
 meta_description?: string;
 meta_keywords?: string[];
 children: CategoryNode[];
 created_at: string;
 updated_at: string;
}

export interface FlatCategory {
 id: string;
 name: string;
 level: number;
 indent: string; // e.g." └─" built from level
 parent_id: string | null;
 is_active: boolean;
}

/** Recursively flatten a tree into an indented list for selectors. */
export function flattenTree(nodes: CategoryNode[], depth = 0): FlatCategory[] {
 const result: FlatCategory[] = [];
 for (const node of nodes) {
 const prefix = depth === 0 ? '' : ' '.repeat(depth - 1) + '└─ ';
 result.push({
 id: node.id,
 name: node.name,
 level: node.level,
 indent: prefix,
 parent_id: node.parent_id,
 is_active: node.is_active,
 });
 if (node.children?.length) {
 result.push(...flattenTree(node.children, depth + 1));
 }
 }
 return result;
}

/** Recursively find a node by id. */
export function findNode(id: string, nodes: CategoryNode[]): CategoryNode | null {
 for (const node of nodes) {
 if (node.id === id) return node;
 const found = findNode(id, node.children ?? []);
 if (found) return found;
 }
 return null;
}

/** Collect all descendant ids of a node (to block self-reparenting). */
export function collectDescendantIds(node: CategoryNode): string[] {
 const ids: string[] = [node.id];
 for (const child of node.children ?? []) {
 ids.push(...collectDescendantIds(child));
 }
 return ids;
}

export function useCategoryTree() {
 return useQuery<CategoryNode[]>({
 queryKey: ['categories', 'tree'],
 queryFn: async () => {
 return fetchCategoryTreeApi();
 },
 staleTime: 30_000,
 });
}
