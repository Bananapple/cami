import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";
import { useAuth } from "@/hooks/useAuth";

export type WaitlistEntry = {
  id: string;
  class_instance_id: string;
  status: "waiting" | "offered" | "accepted" | "expired" | "cancelled";
  joined_at: string;
  offer_expires_at: string | null;
  class_instances: {
    starts_at: string;
    ends_at: string;
    class_templates: { name: string } | null;
    locations: { name: string; timezone: string | null } | null;
  } | null;
};

export function useWaitlist() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["waitlist"] });

  const query = useQuery({
    queryKey: ["waitlist", user?.id, studioId],
    enabled: !!user && !!studioId,
    queryFn: async (): Promise<WaitlistEntry[]> => {
      const { data, error } = await supabase
        .from("waitlists")
        .select(`
          id, class_instance_id, status, joined_at, offer_expires_at,
          class_instances (
            starts_at, ends_at,
            class_templates ( name ),
            locations ( name, timezone )
          )
        `)
        .eq("studio_id", studioId!)
        .in("status", ["waiting", "offered"])
        .order("joined_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const join = useMutation({
    mutationFn: async (classInstanceId: string) => {
      const { error } = await supabase.from("waitlists").insert({
        studio_id: studioId!,
        class_instance_id: classInstanceId,
        user_id: user!.id,
        status: "waiting",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["class_instances"] });
    },
  });

  const leave = useMutation({
    mutationFn: async (waitlistId: string) => {
      const { error } = await supabase
        .from("waitlists")
        .update({ status: "cancelled" })
        .eq("id", waitlistId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { waitlist: query.data ?? [], isLoading: query.isLoading, error: query.error, join, leave };
}
