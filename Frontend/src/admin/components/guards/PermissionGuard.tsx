import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { hasPermission, hasAnyPermission } from '@/admin/lib/permissions';
import type { ReactNode } from 'react';

interface Props {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, anyOf, children, fallback = null }: Props) {
  const perms = useMyPermissions();
  if (permission && hasPermission(perms, permission)) return <>{children}</>;
  if (anyOf && hasAnyPermission(perms, ...anyOf)) return <>{children}</>;
  return <>{fallback}</>;
}
