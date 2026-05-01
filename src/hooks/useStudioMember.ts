import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useStudioContext } from "@/context/StudioContext";

export function useStudioMember() {
  const { user } = useAuth();
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;

  const { data: studioMember, isLoading, error } = useQuery({
    queryKey: ["studio_member_data", user?.id, studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_members")
        .select("level, total_sessions, referral_code")
        .eq("user_id", user!.id)
        .eq("studio_id", studioId!)
        .maybeSingle();
      if (error) throw error;
      return data as { level: string | null; total_sessions: number; referral_code: string | null } | null;
    },
    enabled: !!user && !!studioId,
  });

  return { studioMember, isLoading, error };
}
