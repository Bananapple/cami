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
        .select("*, session:sessions(*)")
        .eq("user_id", user!.id)
        .eq("status", "confirmed")
        .gte("session_date", new Date().toISOString().split("T")[0])
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createBooking = useMutation({
    mutationFn: async ({
      sessionId,
      sessionDate,
      paymentMethodLast4,
      amountPaid,
    }: {
      sessionId: string;
      sessionDate: string;
      paymentMethodLast4: string;
      amountPaid: number;
    }) => {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          user_id: user!.id,
          session_id: sessionId,
          session_date: sessionDate,
          payment_method_last4: paymentMethodLast4,
          amount_paid: amountPaid,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.rpc("increment_user_sessions", { p_user_id: user!.id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });

  return { bookings, isLoading, createBooking, cancelBooking };
}
