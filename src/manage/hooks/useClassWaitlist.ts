import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WaitlistEntry = {
  id: string;
  user_id: string;
  status: "waiting" | "offered";
  joined_at: string;
  offer_expires_at: string | null;
  full_name: string | null;
  email: string | null;
};

export function waitlistQueryKey(classInstanceId: string) {
  return ["manage", "waitlist", classInstanceId];
}

export function useClassWaitlist(classInstanceId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: waitlistQueryKey(classInstanceId ?? ""),
    enabled: !!classInstanceId,
    queryFn: async (): Promise<WaitlistEntry[]> => {
      const { data, error } = await supabase
        .from("waitlists")
        .select(`
          id, user_id, status, joined_at, offer_expires_at,
          profiles ( full_name, email )
        `)
        .eq("class_instance_id", classInstanceId!)
        .in("status", ["waiting", "offered"])
        .order("joined_at");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        status: r.status,
        joined_at: r.joined_at,
        offer_expires_at: r.offer_expires_at,
        full_name: r.profiles?.full_name ?? null,
        email: r.profiles?.email ?? null,
      }));
    },
  });

  const remove = useMutation({
    mutationFn: async (waitlistId: string) => {
      const { error } = await supabase
        .from("waitlists")
        .update({ status: "cancelled" })
        .eq("id", waitlistId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: waitlistQueryKey(classInstanceId ?? "") });
    },
  });

  return { entries: query.data ?? [], isLoading: query.isLoading, remove };
}
