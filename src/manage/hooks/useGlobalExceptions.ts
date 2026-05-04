import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

// "Global exception" = a date on which all active class types are cancelled
// (e.g. studio closed for a holiday). Implemented without schema change by
// inserting one schedule_exceptions row per active rule for that date, all
// tagged with reason='global_cancel: <free text>'. The materializer already
// deletes un-booked instances on those dates and leaves booked ones alone.

export type GlobalException = {
  date: string;            // YYYY-MM-DD
  reason: string | null;   // free text after the "global_cancel:" prefix
  exception_ids: string[]; // schedule_exceptions rows that make up this date
};

const TAG = "global_cancel";

export function useGlobalExceptions() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage", "global_exceptions", studioId] });
    qc.invalidateQueries({ queryKey: ["manage", "schedule", studioId] });
    qc.invalidateQueries({ queryKey: ["manage", "today"] });
  };

  const query = useQuery({
    queryKey: ["manage", "global_exceptions", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<GlobalException[]> => {
      const { data, error } = await supabase
        .from("schedule_exceptions")
        .select("id, exception_date, reason")
        .eq("studio_id", studioId!)
        .eq("kind", "cancel")
        .like("reason", `${TAG}%`)
        .order("exception_date");
      if (error) throw error;

      const byDate = new Map<string, GlobalException>();
      for (const r of data ?? []) {
        const reasonText = (r.reason as string).startsWith(`${TAG}:`)
          ? (r.reason as string).slice(TAG.length + 1).trim() || null
          : null;
        const existing = byDate.get(r.exception_date);
        if (existing) {
          existing.exception_ids.push(r.id);
        } else {
          byDate.set(r.exception_date, {
            date: r.exception_date,
            reason: reasonText,
            exception_ids: [r.id],
          });
        }
      }
      return Array.from(byDate.values());
    },
  });

  // Add: insert one cancel exception per active rule for the given date.
  const add = useMutation({
    mutationFn: async (input: { date: string; reason?: string }) => {
      if (!studioId) throw new Error("No studio");

      // Find every active rule
      const { data: rules, error: e1 } = await supabase
        .from("schedule_rules")
        .select("id")
        .eq("studio_id", studioId)
        .eq("is_active", true);
      if (e1) throw e1;
      if (!rules || rules.length === 0) {
        throw new Error("No active class types — nothing to cancel.");
      }

      const reasonField = input.reason
        ? `${TAG}: ${input.reason.trim()}`
        : TAG;

      const rows = rules.map((r) => ({
        studio_id: studioId,
        rule_id: r.id,
        exception_date: input.date,
        kind: "cancel" as const,
        reason: reasonField,
      }));

      // upsert avoids 23505 on the (rule_id, exception_date) unique
      const { error: e2 } = await supabase
        .from("schedule_exceptions")
        .upsert(rows, { onConflict: "rule_id,exception_date" });
      if (e2) throw e2;

      // Re-materialize so the existing un-booked instances on that date
      // get cleaned up.
      await supabase.rpc("materialize_class_instances" as any);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (date: string) => {
      if (!studioId) throw new Error("No studio");
      const { error } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("studio_id", studioId)
        .eq("exception_date", date)
        .eq("kind", "cancel")
        .like("reason", `${TAG}%`);
      if (error) throw error;
      await supabase.rpc("materialize_class_instances" as any);
    },
    onSuccess: invalidate,
  });

  return {
    exceptions: query.data ?? [],
    isLoading: query.isLoading,
    add,
    remove,
  };
}
