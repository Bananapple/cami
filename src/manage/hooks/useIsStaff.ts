import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsStaff() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["manage", "is-staff", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("studio_members")
        .select("role")
        .eq("is_active", true)
        .in("role", ["owner", "manager", "instructor"])
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
}
