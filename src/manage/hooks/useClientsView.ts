import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type MemberSummary = {
  studio_member_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  total_sessions: number;
  level: string | null;
  joined_at: string;
  membership_id: string | null;
  membership_status: string | null;
  credits_remaining: number | null;
  valid_until: string | null;
  plan_name: string | null;
  plan_type: string | null;
  last_booking_at: string | null;
};

// Thresholds (days) — adjust here to tune segment definitions
export const T = {
  newMemberDays: 30,
  oneTimerCooldownDays: 14,
  regularActiveDays: 30,
  lapsingMinSessions: 3,
  lapsingFromDays: 90,
  lapsingToDays: 45,
  inactiveMinSessions: 2,
  inactiveDays: 90,
};

export type SegmentKey = "all" | "new" | "one_timer" | "regular" | "lapsing" | "inactive" | "no_plan";

export const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "new",       label: "New" },
  { key: "regular",   label: "Regular" },
  { key: "one_timer", label: "One-timers" },
  { key: "lapsing",   label: "Lapsing" },
  { key: "inactive",  label: "Inactive" },
  { key: "no_plan",   label: "No plan" },
];

export function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

export function inSegment(m: MemberSummary, key: SegmentKey): boolean {
  const lastBooking = m.last_booking_at ? new Date(m.last_booking_at) : null;
  const joined = new Date(m.joined_at);

  switch (key) {
    case "all":
      return true;
    case "new":
      return joined > daysAgo(T.newMemberDays);
    case "one_timer":
      return m.total_sessions === 1 && (!lastBooking || lastBooking < daysAgo(T.oneTimerCooldownDays));
    case "regular":
      return !!lastBooking && lastBooking > daysAgo(T.regularActiveDays);
    case "lapsing":
      return (
        m.total_sessions >= T.lapsingMinSessions &&
        !!lastBooking &&
        lastBooking < daysAgo(T.lapsingToDays) &&
        lastBooking > daysAgo(T.lapsingFromDays)
      );
    case "inactive":
      return (
        m.total_sessions >= T.inactiveMinSessions &&
        (!lastBooking || lastBooking < daysAgo(T.inactiveDays))
      );
    case "no_plan":
      return !m.membership_id;
    default:
      return true;
  }
}

export function useClientsView() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;

  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("all");

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

  const members = query.data ?? [];

  const segmentCounts = useMemo(() => {
    const counts: Partial<Record<SegmentKey, number>> = {};
    for (const seg of SEGMENTS) {
      counts[seg.key] = members.filter((m) => inSegment(m, seg.key)).length;
    }
    return counts;
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members
      .filter((m) => inSegment(m, activeSegment))
      .filter((m) => {
        if (!q) return true;
        return (
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
        );
      });
  }, [members, activeSegment, search]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    members,
    filtered,
    segmentCounts,
    segments: SEGMENTS,
    search,
    setSearch,
    activeSegment,
    setActiveSegment,
  };
}
