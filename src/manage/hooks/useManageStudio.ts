import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export function useManageStudio() {
  const studioCtx = useStudioContext();
  const studio = studioCtx?.studio;
  const studioId = studio?.id;
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async (updates: {
      referral_enabled?: boolean;
      referral_discount_percent?: number;
    }) => {
      const { error } = await (supabase as any)
        .from("studios")
        .update(updates)
        .eq("id", studioId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio"] }),
  });

  return { studio, save };
}
