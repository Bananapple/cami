import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";
import type { SegmentConfig } from "@/types/database";

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
  status: string; // 'active' | 'on_leave' | 'inactive'
  membership_id: string | null;
  membership_status: string | null;
  credits_remaining: number | null;
  valid_until: string | null;
  plan_name: string | null;
  plan_type: string | null; // 'drop_in' | 'clip_card' | 'subscription' | 'addon' | 'private' | null
  last_booking_at: string | null;
  // Raw evidence (added in 0024)
  source: string | null;
  bookings_last_30d: number;
  bookings_last_90d: number;
  top_template_id: string | null;
  top_template_name: string | null;
  top_time_bucket: string | null; // 'morning' | 'midday' | 'evening' | null
  credits_expiring_soon: boolean;
  sub_renewing_soon: boolean;
};

// ── Lifecycle (one-of, mutually exclusive) ────────────────────────────
export type SegmentKey =
  | "all"
  | "new"
  | "one_timer"
  | "regular"
  | "lapsing"
  | "inactive"
  | "no_plan"
  | "on_leave";

export const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "new",       label: "New" },
  { key: "regular",   label: "Regular" },
  { key: "one_timer", label: "One-timers" },
  { key: "lapsing",   label: "Lapsing" },
  { key: "inactive",  label: "Inactive" },
  { key: "no_plan",   label: "No plan" },
  { key: "on_leave",  label: "On leave" },
];

// ── Frequency tier (computed from bookings_last_30d + studio config) ──
export type FrequencyTier = "none" | "casual" | "regular" | "devotee";

export const FREQUENCY_LABELS: Record<FrequencyTier, string> = {
  none: "Inactive",
  casual: "Casual",
  regular: "Regular",
  devotee: "Devotee",
};

export function frequencyTier(
  member: MemberSummary,
  config: SegmentConfig,
): FrequencyTier {
  const n = member.bookings_last_30d ?? 0;
  if (n >= config.frequency.devoteeMin) return "devotee";
  if (n >= config.frequency.regularMin) return "regular";
  if (n >= config.frequency.casualMin) return "casual";
  return "none";
}

// ── Tags (many-to-many, overlapping) ──────────────────────────────────
export type TagKey = "plan" | "frequency" | "source" | "time" | "class";

export type TagFilter = { key: TagKey; value: string };

export const TAG_LABELS: Record<TagKey, string> = {
  plan: "Plan",
  frequency: "Frequency",
  source: "Source",
  time: "Time",
  class: "Class",
};

// Display labels for fixed-set tag values. Free-set values (source, class)
// fall through to a humanize() helper below.
export const PLAN_LABELS: Record<string, string> = {
  drop_in: "Drop-in",
  clip_card: "Clip card",
  subscription: "Subscription",
  addon: "Add-on",
  private: "Private",
};

export const TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
};

export function tagValueLabel(key: TagKey, value: string, member?: MemberSummary): string {
  switch (key) {
    case "plan": return PLAN_LABELS[value] ?? humanize(value);
    case "frequency": return FREQUENCY_LABELS[value as FrequencyTier] ?? humanize(value);
    case "time": return TIME_LABELS[value] ?? humanize(value);
    case "class": return member?.top_template_name ?? value;
    case "source": return humanize(value);
  }
}

export function humanize(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Defaults (used as fallback if studios.segment_config isn't seeded yet) ──
export const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  lifecycle: {
    newDays: 30,
    regularDays: 30,
    lapsingFromDays: 90,
    lapsingToDays: 45,
    lapsingMinSessions: 3,
    inactiveDays: 90,
    inactiveMinSessions: 2,
    oneTimerCooldownDays: 14,
  },
  frequency: { casualMin: 1, regularMin: 4, devoteeMin: 8 },
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

// ── Lifecycle predicate ───────────────────────────────────────────────
export function inSegment(
  m: MemberSummary,
  key: SegmentKey,
  config: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
): boolean {
  const lc = config.lifecycle;
  const lastBooking = m.last_booking_at ? new Date(m.last_booking_at) : null;
  const joined = new Date(m.joined_at);
  const isOnLeave = m.status === "on_leave";

  switch (key) {
    case "all":
      return true;
    case "on_leave":
      return isOnLeave;
    case "new":
      return !isOnLeave && joined > daysAgo(lc.newDays);
    case "one_timer":
      return (
        !isOnLeave &&
        m.total_sessions === 1 &&
        (!lastBooking || lastBooking < daysAgo(lc.oneTimerCooldownDays))
      );
    case "regular":
      return !isOnLeave && !!lastBooking && lastBooking > daysAgo(lc.regularDays);
    case "lapsing":
      return (
        !isOnLeave &&
        m.total_sessions >= lc.lapsingMinSessions &&
        !!lastBooking &&
        lastBooking < daysAgo(lc.lapsingToDays) &&
        lastBooking > daysAgo(lc.lapsingFromDays)
      );
    case "inactive":
      return (
        !isOnLeave &&
        m.total_sessions >= lc.inactiveMinSessions &&
        (!lastBooking || lastBooking < daysAgo(lc.inactiveDays))
      );
    case "no_plan":
      return !m.membership_id;
    default:
      return true;
  }
}

// ── Tag predicate ─────────────────────────────────────────────────────
export function inTag(
  m: MemberSummary,
  tag: TagFilter,
  config: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
): boolean {
  switch (tag.key) {
    case "plan": return m.plan_type === tag.value;
    case "frequency": return frequencyTier(m, config) === tag.value;
    case "source": return m.source === tag.value;
    case "time": return m.top_time_bucket === tag.value;
    case "class": return m.top_template_id === tag.value;
  }
}

// ── Filter state ──────────────────────────────────────────────────────
export type ClientsFilter = {
  lifecycle: SegmentKey;
  tags: TagFilter[];
  text: string;
};

export const EMPTY_FILTER: ClientsFilter = {
  lifecycle: "all",
  tags: [],
  text: "",
};

function tagKey(t: TagFilter): string {
  return `${t.key}:${t.value}`;
}

// ── Hook ──────────────────────────────────────────────────────────────
// `initialFilter` lets the consumer hydrate from URL params synchronously on
// mount (avoids a race where useEffect-based hydration is clobbered by a
// mirror effect before state updates flush).
export function useClientsView(initialFilter?: ClientsFilter) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const config: SegmentConfig =
    studioCtx?.studio?.segment_config ?? DEFAULT_SEGMENT_CONFIG;

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

  const members = query.data ?? [];

  // Counts per lifecycle key. 'all' is always members.length.
  const segmentCounts = useMemo(() => {
    const counts: Partial<Record<SegmentKey, number>> = {};
    for (const seg of SEGMENTS) {
      counts[seg.key] = members.filter((m) => inSegment(m, seg.key, config)).length;
    }
    return counts as Record<SegmentKey, number>;
  }, [members, config]);

  // Counts per tag (key → value → count). Used by the filter bar to render
  // suggestions and auto-hide values with zero matches.
  const tagCounts = useMemo(() => {
    const counts: Record<TagKey, Record<string, number>> = {
      plan: {},
      frequency: {},
      source: {},
      time: {},
      class: {},
    };
    for (const m of members) {
      if (m.plan_type) counts.plan[m.plan_type] = (counts.plan[m.plan_type] ?? 0) + 1;
      const f = frequencyTier(m, config);
      counts.frequency[f] = (counts.frequency[f] ?? 0) + 1;
      if (m.source) counts.source[m.source] = (counts.source[m.source] ?? 0) + 1;
      if (m.top_time_bucket) counts.time[m.top_time_bucket] = (counts.time[m.top_time_bucket] ?? 0) + 1;
      if (m.top_template_id) counts.class[m.top_template_id] = (counts.class[m.top_template_id] ?? 0) + 1;
    }
    return counts;
  }, [members, config]);

  // Top template id → name lookup, for rendering class tag suggestions.
  const classNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) {
      if (m.top_template_id && m.top_template_name) {
        map[m.top_template_id] = m.top_template_name;
      }
    }
    return map;
  }, [members]);

  // AND-combined filter: lifecycle + every tag pill + free-text on name/email/phone.
  const filtered = useMemo(() => {
    const q = filter.text.trim().toLowerCase();
    return members.filter((m) => {
      if (!inSegment(m, filter.lifecycle, config)) return false;
      for (const tag of filter.tags) {
        if (!inTag(m, tag, config)) return false;
      }
      if (q) {
        const hit =
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.phone_number?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [members, filter, config]);

  // Convenience setters used by MemberFilterBar.
  const setLifecycle = (key: SegmentKey) =>
    setFilter((f) => ({ ...f, lifecycle: key }));
  const addTag = (tag: TagFilter) =>
    setFilter((f) =>
      f.tags.some((t) => tagKey(t) === tagKey(tag))
        ? f
        : { ...f, tags: [...f.tags, tag] },
    );
  const removeTag = (tag: TagFilter) =>
    setFilter((f) => ({ ...f, tags: f.tags.filter((t) => tagKey(t) !== tagKey(tag)) }));
  const popLastPill = () =>
    setFilter((f) => {
      if (f.tags.length > 0) return { ...f, tags: f.tags.slice(0, -1) };
      if (f.lifecycle !== "all") return { ...f, lifecycle: "all" };
      return f;
    });

  return {
    isLoading: query.isLoading,
    error: query.error,
    members,
    filtered,
    segmentCounts,
    tagCounts,
    classNames,
    segments: SEGMENTS,
    filter,
    setFilter,
    setLifecycle,
    addTag,
    removeTag,
    popLastPill,
    config,
  };
}
