import { Navigate } from 'react-router-dom';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission, hasAnyPermission } from '@/admin/lib/permissions';

interface RequirePermissionProps {
  /** Single permission key required */
  permission?: string;
  /** Any one of these permission keys is sufficient */
  anyOf?: string[];
  /** Redirect path on denial (default: /403) */
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Gates a route on one or more permission keys.
 * Usage:
 *   <RequirePermission permission="order:read">...</RequirePermission>
 *   <RequirePermission anyOf={['order:write', 'order:fulfill']}>...</RequirePermission>
 */
export function RequirePermission({
  permission,
  anyOf,
  redirectTo = '/403',
  children,
}: RequirePermissionProps) {
  const perms = useMyPermissions();

  if (perms.isLoading) return null; // RequireAuth already shows a spinner above

  const allowed = permission
    ? hasPermission(perms, permission)
    : anyOf
    ? hasAnyPermission(perms, ...anyOf)
    : true;

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}