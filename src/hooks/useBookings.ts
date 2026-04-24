import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useBookings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, cancelled_at, payment_id, class_instance_id,
          class_instances ( id, starts_at, template_id,
            class_templates ( name, default_duration_minutes )
          )
        `)
        .eq("user_id", user!.id)
        .eq("status", "confirmed");
      if (error) throw error;
      return (data ?? []).filter((b: any) => {
        const startsAt = b.class_instances?.starts_at;
        return startsAt && new Date(startsAt) > new Date();
      });
    },
    enabled: !!user,
  });

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user) throw new Error("Not authenticated");
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
        } catch {}
        throw new Error(message);
      }
      return data as { cancelled: boolean; refunded: boolean; refund_amount?: number; reason?: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });

  return { bookings, isLoading, cancelBooking };
}
