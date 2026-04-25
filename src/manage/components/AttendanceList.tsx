import { Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useClassAttendance,
  attendanceQueryKey,
  type Attendee,
} from "../hooks/useClassAttendance";
import { useDrawerStack } from "../hooks/useDrawerStack";

export function AttendanceList({ classInstanceId }: { classInstanceId: string }) {
  const { data: attendees = [], isLoading } = useClassAttendance(classInstanceId);
  const { push } = useDrawerStack();
  const queryClient = useQueryClient();
  const queryKey = attendanceQueryKey(classInstanceId);

  const checkIn = useMutation({
    mutationFn: async ({ bookingId, checkedIn }: { bookingId: string; checkedIn: boolean }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onMutate: async ({ bookingId, checkedIn }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Attendee[]>(queryKey);
      queryClient.setQueryData<Attendee[]>(queryKey, (old) =>
        old?.map((a) =>
          a.booking_id === bookingId
            ? { ...a, checked_in_at: checkedIn ? new Date().toISOString() : null }
            : a
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("Could not update check-in.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading attendance...</p>;
  if (attendees.length === 0)
    return <p className="text-sm text-muted-foreground py-2">No bookings yet.</p>;

  return (
    <div className="space-y-1">
      {attendees.map((a) => {
        const isChecked = !!a.checked_in_at;
        return (
          <div
            key={a.booking_id}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
          >
            <button
              onClick={() =>
                checkIn.mutate({ bookingId: a.booking_id, checkedIn: !isChecked })
              }
              disabled={checkIn.isPending}
              className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border hover:border-primary"
              }`}
              aria-label={isChecked ? "Uncheck" : "Check in"}
            >
              {isChecked && <Check className="w-3 h-3" />}
            </button>
            <button
              onClick={() => push({ type: "member", id: a.user_id })}
              className="flex-1 text-left text-sm hover:underline"
            >
              {a.full_name}
            </button>
            <span className="text-xs text-muted-foreground capitalize">{a.status}</span>
          </div>
        );
      })}
    </div>
  );
}
