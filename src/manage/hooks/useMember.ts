import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MemberMembership = {
  id: string;
  plan_name: string;
  plan_type: string;
  credits_remaining: number | null;
  valid_until: string | null;
};

export type ManagerMember = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  level: string | null;
  total_sessions: number;
  no_shows: number;
  joined_at: string | null;
  membership: MemberMembership | null;
};

export function useMember(userId: string | undefined) {
  return useQuery({
    queryKey: ["manage", "member", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ManagerMember | null> => {
      if (!userId) return null;

      const now = new Date().toISOString();
      const [
        { data: profile, error: profileErr },
        { data: studioMember },
        { data: memberships },
        { data: noShowBookings },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone_number")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("studio_members")
          .select("level, total_sessions, joined_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("memberships")
          .select("id, status, credits_remaining, valid_until, products(name, type)")
          .eq("user_id", userId)
          .eq("status", "active")
          .limit(1),
        supabase
          .from("bookings")
          .select("id, class_instances!inner(ends_at)")
          .eq("user_id", userId)
          .eq("status", "confirmed")
          .is("checked_in_at", null)
          .lt("class_instances.ends_at", now),
      ]);

      if (profileErr) throw profileErr;
      if (!profile) return null;

      const m = memberships?.[0] as any;
      const membership: MemberMembership | null = m
        ? {
            id: m.id,
            plan_name: m.products?.name ?? "Membership",
            plan_type: m.products?.type ?? "subscription",
            credits_remaining: m.credits_remaining ?? null,
            valid_until: m.valid_until ?? null,
          }
        : null;

      return {
        user_id: profile.id,
        full_name: profile.full_name ?? "Unknown",
        email: profile.email ?? null,
        phone_number: profile.phone_number ?? null,
        level: studioMember?.level ?? null,
        total_sessions: studioMember?.total_sessions ?? 0,
        no_shows: (noShowBookings ?? []).length,
        joined_at: (studioMember as any)?.joined_at ?? null,
        membership,
      };
    },
  });
}
