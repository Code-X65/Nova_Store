import { Navigate } from 'react-router-dom';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission, hasAnyPermission, hasRole } from '@/admin/lib/permissions';

interface RequirePermissionProps {
  /** Single permission key required */
  permission?: string;
  /** Any one of these permission keys is sufficient */
  anyOf?: string[];
  /**
   * Role-based fallback: access is granted if the user holds ANY of these
   * roles, regardless of permission slugs. Mirrors backend role middleware
   * (e.g. requireManager) for routes that don't enforce a slug on GETs.
   */
  roles?: string[];
  /** Redirect path on denial (default: /403) */
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Gates a route on one or more permission keys, with an optional role-based
 * fallback for routes the backend guards by role middleware rather than slugs.
 *
 * Usage:
 *   <RequirePermission permission="order:read">…</RequirePermission>
 *   <RequirePermission anyOf={['order:write', 'order:fulfill']}>…</RequirePermission>
 *   <RequirePermission anyOf={['staff:read']} roles={['MANAGER','STORE_OWNER']}>…</RequirePermission>
 */
export function RequirePermission({
  permission,
  anyOf,
  roles,
  redirectTo = '/403',
  children,
}: RequirePermissionProps) {
  const perms = useMyPermissions();

  if (perms.isLoading) return null; // RequireAuth already shows a spinner above

  // Check slug-based access
  const slugAllowed = permission
    ? hasPermission(perms, permission)
    : anyOf
    ? hasAnyPermission(perms, ...anyOf)
    : true;

  // Check role-based fallback (if roles prop is provided)
  const roleAllowed = roles ? hasRole(perms, ...roles) : false;

  if (!slugAllowed && !roleAllowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}