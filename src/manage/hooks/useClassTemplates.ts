import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type ClassTemplate = {
  id: string;
  name: string;
  level: string | null;
  default_duration_minutes: number;
  default_price: number;
  default_max_capacity: number;
  is_active: boolean;
};

export function useClassTemplates() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["manage", "class_templates", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<ClassTemplate[]> => {
      const { data, error } = await supabase
        .from("class_templates")
        .select("id, name, level, default_duration_minutes, default_price, default_max_capacity, is_active")
        .eq("studio_id", studioId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassTemplate[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["manage", "class_templates", studioId] });

  const createTemplate = useMutation({
    mutationFn: async (input: Omit<ClassTemplate, "id" | "is_active">) => {
      const { error } = await supabase.from("class_templates").insert({
        studio_id: studioId,
        ...input,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ClassTemplate> & { id: string }) => {
      const { error } = await supabase.from("class_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("class_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    createTemplate,
    updateTemplate,
    toggleActive,
  };
}
