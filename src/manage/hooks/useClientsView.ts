import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

// ── Member shape (mirrors member_activity_summary view, post-0024) ────
export type MemberSummary = {
  studio_member_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  total_sessions: number;
  level: string | null;
  joined_at: string;
  status: string;
  membership_id: string | null;
  membership_status: string | null;
  credits_remaining: number | null;
  valid_until: string | null;
  plan_name: string | null;
  plan_type: string | null;
  last_booking_at: string | null;
  source: string | null;
  bookings_last_30d: number;
  bookings_last_90d: number;
  top_template_id: string | null;
  top_template_name: string | null;
  top_time_bucket: string | null;
  credits_expiring_soon: boolean;
  sub_renewing_soon: boolean;
};

export type ClientsFilter = { text: string };

export const EMPTY_FILTER: ClientsFilter = { text: "" };

export function useClientsView(initialFilter?: ClientsFilter) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;

  const [filter, setFilter] = useState<ClientsFilter>(initialFilter ?? EMPTY_FILTER);

  const query = useQuery({
    queryKey: ["manage", "clients", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<MemberSummary[]> => {
      const { data, error } = await supabase
        .from("member_activity_summary" as any)
        .select("*")
        .eq("studio_id", studioId)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MemberSummary[];
    },
  });

  const members = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    const q = filter.text.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone_number?.toLowerCase().includes(q),
    );
  }, [members, filter.text]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    members,
    filtered,
    filter,
    setFilter,
  };
}
