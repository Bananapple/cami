import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NotificationEntry = {
  id: string;
  template: string;
  channel: string;
  sent_at: string;
  error: string | null;
};

const TEMPLATE_LABELS: Record<string, string> = {
  booking_confirmation: "Booking confirmation",
  membership_confirmation: "Membership confirmation",
  waitlist_offer: "Waitlist offer",
  class_reminder: "Class reminder",
  cancellation: "Cancellation",
};

export function useNotificationLog(userId: string | undefined) {
  return useQuery({
    queryKey: ["manage", "member", userId, "notifications"],
    enabled: !!userId,
    queryFn: async (): Promise<NotificationEntry[]> => {
      const { data, error } = await supabase
        .from("notification_log")
        .select("id, template, channel, sent_at, error")
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as NotificationEntry[];
    },
  });
}

export function templateLabel(template: string): string {
  return TEMPLATE_LABELS[template] ?? template.replace(/_/g, " ");
}
