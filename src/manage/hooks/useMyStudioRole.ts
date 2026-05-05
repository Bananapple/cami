import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudioContext } from "@/context/StudioContext";

export type StudioRole = "owner" | "manager" | "instructor" | "member" | null;

export function useMyStudioRole() {
  const { user } = useAuth();
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;

  return useQuery({
    queryKey: ["manage", "my-role", user?.id, studioId],
    enabled: !!user && !!studioId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<StudioRole> => {
      if (!user || !studioId) return null;
      const { data } = await supabase
        .from("studio_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("studio_id", studioId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return (data?.role as StudioRole) ?? null;
    },
  });
}
