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
      <div className="fixed inset-0 z-[999] bg-[var(--bg-base)] flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-6 animate-in fade-in duration-500">
          <div className="relative">
             {/* Glowing backdrop */}
             <div className="absolute inset-0 bg-[var(--neu-accent)]/20 blur-2xl rounded-full scale-150 animate-pulse" />
             {/* Logo / Spinner */}
             <div className="w-16 h-16 rounded-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] shadow-2xl shadow-[var(--neu-accent)]/10 flex items-center justify-center relative z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--neu-accent)]/20 to-transparent opacity-50" />
                <svg className="w-8 h-8 text-[var(--neu-accent)] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}