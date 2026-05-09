import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    // Supabase client auto-processes the session from the URL hash on mount.
    // Give it 500ms then close the popup — parent's onAuthStateChange fires via localStorage.
    const t = setTimeout(() => window.close(), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">
      Signing in…
    </div>
  );
}
