import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ManagerMember = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  level: string | null;
  total_sessions: number;
};

export function useMember(userId: string | undefined) {
  return useQuery({
    queryKey: ["manage", "member", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ManagerMember | null> => {
      if (!userId) return null;

      const [{ data: profile, error: profileErr }, { data: studioMember }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone_number")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("studio_members")
          .select("level, total_sessions")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (profileErr) throw profileErr;
      if (!profile) return null;

      return {
        user_id: profile.id,
        full_name: profile.full_name ?? "Unknown",
        email: profile.email ?? null,
        phone_number: profile.phone_number ?? null,
        level: studioMember?.level ?? null,
        total_sessions: studioMember?.total_sessions ?? 0,
      };
    },
  });
}
