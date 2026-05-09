import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useStudioContext } from "@/context/StudioContext";

export function useMembership() {
  const { user } = useAuth();
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const queryClient = useQueryClient();

  const { data: membership, isLoading, error } = useQuery({
    queryKey: ["membership", user?.id, studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user!.id)
        .eq("studio_id", studioId!)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!studioId,
  });

  const cancelMembership = useMutation({
    mutationFn: async (membershipId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("cancel-membership", {
        body: { membership_id: membershipId },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) {
        let message = "Failed to cancel membership";
        try {
          if (error?.context) {
            const body = await error.context.json();
            message = body.error ?? message;
          }
        } catch { /* ignore */ }
        throw new Error(message);
      }
      return data as { scheduled: boolean; ends_at: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership"] });
    },
  });

  return { membership, isLoading, error, cancelMembership };
}
