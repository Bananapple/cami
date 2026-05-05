import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Cancels a single class instance and refunds/returns credits to every
// confirmed or pending booking on it. Refunds run in parallel via the
// existing issue-refund Edge Function (which handles Stripe refunds,
// membership-credit returns, and booking-status updates per booking).
//
// Returns a summary so the UI can toast something useful.

export type CancelClassResult = {
  refunded: number;       // Stripe refunds issued
  credits_returned: number;
  not_refunded: number;   // inside-window bookings (booking still cancelled, no money back)
  failed: number;
};

export function useCancelClass() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      class_instance_id: string;
      reason?: string;
    }): Promise<CancelClassResult> => {
      // 1. Pull every booking that needs handling (confirmed + pending)
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("class_instance_id", input.class_instance_id)
        .in("status", ["confirmed", "pending"]);
      if (bErr) throw bErr;

      // 2. Fan out: call issue-refund per booking. It cancels the booking
      //    and decides refund/credit-return/no-op based on window + payment type.
      const results = await Promise.all(
        (bookings ?? []).map(async (b) => {
          try {
            const { data, error } = await supabase.functions.invoke("issue-refund", {
              body: { booking_id: b.id },
            });
            if (error) return { ok: false as const };
            return { ok: true as const, data };
          } catch {
            return { ok: false as const };
          }
        })
      );

      // 3. Mark the class itself cancelled (and stash the reason in notes
      //    if provided — class_instances has no dedicated reason column).
      const update: { status: "cancelled"; notes?: string } = { status: "cancelled" };
      if (input.reason?.trim()) update.notes = `Cancelled: ${input.reason.trim()}`;
      const { error: cErr } = await supabase
        .from("class_instances")
        .update(update)
        .eq("id", input.class_instance_id);
      if (cErr) throw cErr;

      // 4. Tally up
      const summary: CancelClassResult = {
        refunded: 0,
        credits_returned: 0,
        not_refunded: 0,
        failed: 0,
      };
      for (const r of results) {
        if (!r.ok) {
          summary.failed += 1;
          continue;
        }
        const d = r.data as {
          refunded?: boolean;
          credit_returned?: boolean;
        } | null;
        if (d?.refunded) summary.refunded += 1;
        else if (d?.credit_returned) summary.credits_returned += 1;
        else summary.not_refunded += 1;
      }
      return summary;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage", "schedule"] });
      qc.invalidateQueries({ queryKey: ["manage", "today"] });
      qc.invalidateQueries({ queryKey: ["manage", "class_attendance"] });
      qc.invalidateQueries({ queryKey: ["manage", "class_waitlist"] });
    },
  });
}
