import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MemberBooking = {
  id: string;
  status: string;
  starts_at: string;
  class_name: string;
  class_level: string | null;
  location_timezone: string | null;
  booked_at: string | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  payment_id: string | null;
  membership_id: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_refunded: number | null;
};

export function useMemberBookings(userId: string | undefined) {
  return useQuery({
    queryKey: ["manage", "member", userId, "bookings"],
    enabled: !!userId,
    queryFn: async (): Promise<MemberBooking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, booked_at, cancelled_at, checked_in_at, payment_id, membership_id,
          class_instances (
            starts_at,
            class_templates ( name, level ),
            locations ( timezone )
          ),
          payments ( status, amount, refunded_amount )
        `)
        .eq("user_id", userId)
        .in("status", ["confirmed", "cancelled"])
        .order("booked_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      return (data ?? []).map((b: any) => ({
        id: b.id,
        status: b.status,
        starts_at: b.class_instances?.starts_at ?? "",
        class_name: b.class_instances?.class_templates?.name ?? "Class",
        class_level: b.class_instances?.class_templates?.level ?? null,
        location_timezone: b.class_instances?.locations?.timezone ?? null,
        booked_at: b.booked_at ?? null,
        cancelled_at: b.cancelled_at ?? null,
        checked_in_at: b.checked_in_at ?? null,
        payment_id: b.payment_id ?? null,
        membership_id: b.membership_id ?? null,
        payment_status: b.payments?.status ?? null,
        payment_amount: b.payments?.amount ?? null,
        payment_refunded: b.payments?.refunded_amount ?? null,
      }));
    },
  });
}

export function useManagerCancelBooking(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("issue-refund", {
        body: { booking_id: bookingId },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) {
        let message = "Failed to cancel booking";
        try {
          if (error?.context) {
            const body = await error.context.json();
            message = body.error ?? message;
          }
        } catch { /* ignore JSON parse error */ }
        throw new Error(message);
      }
      return data as { cancelled: boolean; refunded: boolean; refund_amount?: number; reason?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manage", "member", userId, "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["manage", "clients"] });
      queryClient.invalidateQueries({ queryKey: ["manage", "today", "classes"] });
      queryClient.invalidateQueries({ queryKey: ["manage", "class"] });
    },
  });
}
