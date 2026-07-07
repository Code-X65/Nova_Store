import { Navigate, useLocation } from 'react-router-dom';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

/**
 * Protects routes that require a valid admin session.
 * Shows a loading spinner while the session is being verified on mount.
 * Redirects to /login with a `from` state if no session exists.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAdminSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Verifying sessionÃ¢â‚¬Â¦</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}