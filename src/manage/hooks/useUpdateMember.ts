import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

// Updates editable member fields. Email isn't editable here because it's
// the auth identity — changing it requires a separate auth.users flow.

export function useUpdateMember() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      full_name?: string;
      phone_number?: string | null;
      level?: string | null;
    }) => {
      if (!studioId) throw new Error("No studio");

      // profiles patch (only defined keys)
      const profilePatch: Record<string, unknown> = {};
      if (input.full_name !== undefined) profilePatch.full_name = input.full_name;
      if (input.phone_number !== undefined) profilePatch.phone_number = input.phone_number;
      if (Object.keys(profilePatch).length) {
        const { error } = await supabase
          .from("profiles")
          .update(profilePatch)
          .eq("id", input.user_id);
        if (error) throw error;
      }

      // studio_members patch (per-tenant fields)
      if (input.level !== undefined) {
        const { error } = await supabase
          .from("studio_members")
          .update({ level: input.level })
          .eq("user_id", input.user_id)
          .eq("studio_id", studioId);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["manage", "member", vars.user_id, studioId] });
      qc.invalidateQueries({ queryKey: ["manage", "clients", studioId] });
    },
  });
}
