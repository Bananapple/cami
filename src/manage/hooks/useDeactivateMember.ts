import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

// Set a member's status. is_active is the source of truth for permissions
// (RLS, can-they-book checks); status is the UI/reporting marker. Keep
// the two coherent: deactivate flips both, reactivate flips both back.

type Status = "active" | "on_leave" | "inactive";

export function useSetMemberStatus() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { user_id: string; status: Status }) => {
      if (!studioId) throw new Error("No studio");
      const is_active = input.status !== "inactive";
      const { error } = await supabase
        .from("studio_members")
        .update({ status: input.status, is_active })
        .eq("user_id", input.user_id)
        .eq("studio_id", studioId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["manage", "member", vars.user_id, studioId] });
      qc.invalidateQueries({ queryKey: ["manage", "clients", studioId] });
    },
  });
}
