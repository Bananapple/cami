import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Studio, StudioMember, StudioContextValue, StudioRole } from "@/types/database";

const StudioContext = createContext<StudioContextValue | null>(null);

function resolveSlug(): string {
  const envSlug = import.meta.env.VITE_STUDIO_SLUG as string | undefined;
  if (envSlug) return envSlug;
  // Derive from subdomain: yogabrie.brie.app → "yogabrie"
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0];
  return "default";
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const slug = resolveSlug();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);

  // Fetch studio by slug — anon. Uses useEffect+useState (not useQuery) for
  // the same reason useProducts does: TanStack Query v5 fails to notify
  // subscribers for anon queries, so the data arrives but no consumer ever
  // re-renders.
  const fetchStudio = async () => {
    const { data, error } = await (supabase as any)
      .from("studios")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    setStudio(error ? null : (data as Studio));
  };

  useEffect(() => {
    let cancelled = false;
    fetchStudio().then(() => {
      // No-op — fetchStudio already set state. The cancelled flag prevents
      // setting state after unmount.
    }).catch(() => {});
    // Re-bind so this effect's cancelled flag short-circuits stale resolves.
    void cancelled;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Track auth state to drive the membership query
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      // Invalidate the membership cache on login/logout
      queryClient.invalidateQueries({ queryKey: ["studio_member"] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Fetch the current user's studio membership — only when authenticated and studio is loaded.
  const { data: membership } = useQuery<StudioMember | null>({
    queryKey: ["studio_member", studio?.id, userId],
    queryFn: async () => {
      if (!studio || !userId) return null;
      const { data } = await (supabase as any)
        .from("studio_members")
        .select("*")
        .eq("studio_id", studio.id)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      return (data as StudioMember) ?? null;
    },
    enabled: !!studio && !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const role: StudioRole | null = membership?.role ?? null;
  const value: StudioContextValue | null = studio
    ? { studio, membership: membership ?? null, role, refreshStudio: fetchStudio }
    : null;

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
}

// useStudio() — throws if studio is not loaded (requires v2 migration).
// Use only in components written for the v2 architecture.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error(
      "useStudio: studio context not available. " +
      "Either the v2 migration has not been applied, or this component is outside <StudioProvider>."
    );
  }
  return ctx;
}

// useStudioContext() — safe version that returns null pre-migration.
// Use for components that need to be compatible with both legacy and v2.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudioContext(): StudioContextValue | null {
  return useContext(StudioContext);
}
