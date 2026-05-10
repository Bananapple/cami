import type { ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStudioMember } from "@/hooks/useStudioMember";
import { useIsStaff } from "../hooks/useIsStaff";

export function StaffGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { data: isStaff, isLoading: staffLoading } = useIsStaff();
  const { studioMember, isLoading: memberLoading } = useStudioMember();

  if (
    authLoading ||
    (isAuthenticated && (staffLoading || isStaff === undefined || memberLoading))
  ) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isStaff) {
    // Distinguish between "you're a customer here, just not staff" and "you have
    // no relationship to this studio at all". The latter shouldn't be sent to
    // /dashboard — that page belongs to this studio and would be empty for them.
    const hasRelationship = studioMember != null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3 px-6">
          <h1 className="text-2xl font-serif">Not authorised</h1>
          <p className="text-sm text-muted-foreground">
            {hasRelationship
              ? "This area is for studio staff. If you believe this is a mistake, contact your studio owner."
              : "You're signed in to a different account. Sign out and sign in with the email associated with this studio."}
          </p>
          {hasRelationship ? (
            <Link
              to="/dashboard"
              className="inline-block mt-4 text-sm px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Back to dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="inline-block mt-4 text-sm px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
