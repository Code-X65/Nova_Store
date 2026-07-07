import type { AdminPermissions } from '@/shared/api';

/**
 * Returns true if the permission set includes the given key.
 * Supports wildcard: if permissions includes '*', always true.
 */
export function hasPermission(perms: AdminPermissions, key: string): boolean {
  if (perms.permissions.includes('*')) return true;
  return perms.permissions.includes(key);
}

/**
 * Returns true if the user has at least one of the given roles.
 */
export function hasRole(perms: AdminPermissions, ...roles: string[]): boolean {
  return roles.some((r) => perms.roles.includes(r));
}

/**
 * Returns true if the user has ALL the listed permission keys.
 */
export function hasAllPermissions(perms: AdminPermissions, ...keys: string[]): boolean {
  return keys.every((k) => hasPermission(perms, k));
}

/**
 * Returns true if the user has ANY of the listed permission keys.
 */
export function hasAnyPermission(perms: AdminPermissions, ...keys: string[]): boolean {
  return keys.some((k) => hasPermission(perms, k));
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Pre-built role checks Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const isOwner    = (p: AdminPermissions) => hasRole(p, 'store_owner');
export const isManager  = (p: AdminPermissions) => hasRole(p, 'manager', 'store_owner');
export const isOrderStaff     = (p: AdminPermissions) => hasRole(p, 'order_staff', 'manager', 'store_owner');
export const isInventoryStaff = (p: AdminPermissions) => hasRole(p, 'inventory_staff', 'manager', 'store_owner');