import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type StudioConfig = Tables<"studio_config">;

export const useStudioConfig = () => {
  const { data } = useQuery({
    queryKey: ["studio_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as StudioConfig | null;
    },
    staleTime: Infinity,
  });

  return {
    studioName: data?.studio_name ?? "Studio",
    location: data?.location ?? "",
    config: data,
  };
};
