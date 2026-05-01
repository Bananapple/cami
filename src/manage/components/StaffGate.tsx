import type { ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsStaff } from "../hooks/useIsStaff";

export function StaffGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: isStaff, isLoading: staffLoading } = useIsStaff();

  if (authLoading || (isAuthenticated && staffLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm font-serif">Checking access...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3 px-6">
          <h1 className="text-2xl font-serif">Not authorised</h1>
          <p className="text-sm text-muted-foreground">
            This area is for studio staff. If you believe this is a mistake, contact your studio
            owner.
          </p>
          <Link
            to="/dashboard"
            className="inline-block mt-4 text-sm px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
