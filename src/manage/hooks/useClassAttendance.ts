import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Attendee = {
  booking_id: string;
  user_id: string;
  full_name: string;
  status: string;
  checked_in_at: string | null;
};

export const attendanceQueryKey = (classInstanceId: string | undefined) =>
  ["manage", "class", classInstanceId, "attendance"] as const;

export function useClassAttendance(classInstanceId: string | undefined) {
  return useQuery({
    queryKey: attendanceQueryKey(classInstanceId),
    enabled: !!classInstanceId,
    queryFn: async (): Promise<Attendee[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, user_id, checked_in_at,
          profiles ( full_name )
        `)
        .eq("class_instance_id", classInstanceId)
        .neq("status", "cancelled")
        .order("id");

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        booking_id: row.id,
        user_id: row.user_id,
        full_name: row.profiles?.full_name ?? "Unknown",
        status: row.status,
        checked_in_at: row.checked_in_at ?? null,
      }));
    },
  });
}
