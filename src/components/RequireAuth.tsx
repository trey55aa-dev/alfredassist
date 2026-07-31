import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isLocalMode } from "@/lib/localMode";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold animate-pulse">
          Awakening Alfred…
        </div>
      </div>
    );
  }

  // Offline mode stands in for a session: Alfred is local-first, so everything
  // works on this device without an account.
  if (!user && !isLocalMode()) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}
