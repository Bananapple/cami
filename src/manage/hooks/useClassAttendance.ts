import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Attendee = {
  booking_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  status: string;
  checked_in_at: string | null;
  membership_id: string | null;
};

export const attendanceQueryKey = (classInstanceId: string | undefined) =>
  ["manage", "class", classInstanceId, "attendance"] as const;

export function useClassAttendance(classInstanceId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: attendanceQueryKey(classInstanceId),
    enabled: !!classInstanceId,
    queryFn: async (): Promise<Attendee[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, user_id, checked_in_at, membership_id,
          profiles ( full_name, email )
        `)
        .eq("class_instance_id", classInstanceId)
        .order("id");

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        booking_id: row.id,
        user_id: row.user_id,
        full_name: row.profiles?.full_name ?? "Unknown",
        email: row.profiles?.email ?? null,
        status: row.status,
        checked_in_at: row.checked_in_at ?? null,
        membership_id: row.membership_id ?? null,
      }));
    },
  });

  const toggleCheckIn = useMutation({
    mutationFn: async ({ booking_id, currently_checked_in }: { booking_id: string; currently_checked_in: boolean }) => {
      const value = currently_checked_in ? null : new Date().toISOString();
      const { error } = await supabase
        .from("bookings")
        .update({ checked_in_at: value })
        .eq("id", booking_id);
      if (error) throw error;
    },
    // Invalidate attendance for this class + the schedule (so booked/attended counts refresh)
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceQueryKey(classInstanceId) });
      qc.invalidateQueries({ queryKey: ["manage", "schedule"] });
    },
  });

  return { ...query, toggleCheckIn };
}
