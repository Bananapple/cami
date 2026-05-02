import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type ManagedLocation = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  default_capacity: number;
  is_active: boolean;
};

export function useManageLocations() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["manage", "locations", studioId] });

  const query = useQuery({
    queryKey: ["manage", "locations", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<ManagedLocation[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, address, timezone, default_capacity, is_active")
        .eq("studio_id", studioId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ManagedLocation[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<ManagedLocation, "id" | "is_active">) => {
      const { error } = await supabase.from("locations").insert({
        studio_id: studioId,
        ...input,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ManagedLocation> & { id: string }) => {
      const { error } = await supabase.from("locations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("locations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    locations: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    toggleActive,
  };
}
