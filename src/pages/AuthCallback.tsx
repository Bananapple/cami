import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    // Supabase client auto-processes the session from the URL hash on mount.
    // Give it 500ms then close the popup — parent's onAuthStateChange fires via localStorage.
    const t = setTimeout(() => window.close(), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
        color: "#888",
        fontSize: 14,
      }}
    >
      Signing in…
    </div>
  );
}
