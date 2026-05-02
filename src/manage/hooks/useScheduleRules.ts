import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type ScheduleRule = {
  id: string;
  template_id: string;
  instructor_id: string | null;
  location_id: string | null;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  price: number;
  max_capacity: number;
  effective_from: string | null;
  effective_until: string | null;
  is_active: boolean;
  // joined
  class_name: string;
  instructor_name: string | null;
  location_name: string | null;
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function useScheduleRules() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["manage", "schedule_rules", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<ScheduleRule[]> => {
      const { data, error } = await supabase
        .from("schedule_rules")
        .select(`
          id, template_id, instructor_id, location_id,
          day_of_week, start_time, duration_minutes, price, max_capacity,
          effective_from, effective_until, is_active,
          class_templates ( name ),
          instructors ( display_name ),
          locations ( name )
        `)
        .eq("studio_id", studioId)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;

      return (data ?? []).map((r: any) => ({
        id: r.id,
        template_id: r.template_id,
        instructor_id: r.instructor_id,
        location_id: r.location_id,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        duration_minutes: r.duration_minutes,
        price: Number(r.price),
        max_capacity: r.max_capacity,
        effective_from: r.effective_from,
        effective_until: r.effective_until,
        is_active: r.is_active,
        class_name: r.class_templates?.name ?? "Class",
        instructor_name: r.instructors?.display_name ?? null,
        location_name: r.locations?.name ?? null,
      }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage", "schedule_rules", studioId] });
    qc.invalidateQueries({ queryKey: ["manage", "schedule", studioId] });
    qc.invalidateQueries({ queryKey: ["manage", "today"] });
  };

  const rematerialize = async () => {
    await supabase.rpc("materialize_class_instances" as any);
  };

  const createRules = useMutation({
    mutationFn: async (input: {
      template_id: string;
      instructor_id: string | null;
      location_id: string | null;
      days: number[];
      start_time: string;
      duration_minutes: number;
      price: number;
      max_capacity: number;
    }) => {
      if (!studioId) throw new Error("No studio");
      const today = new Date().toISOString().slice(0, 10);
      const rows = input.days.map((day) => ({
        studio_id: studioId,
        template_id: input.template_id,
        instructor_id: input.instructor_id,
        location_id: input.location_id,
        day_of_week: day,
        start_time: input.start_time,
        duration_minutes: input.duration_minutes,
        price: input.price,
        max_capacity: input.max_capacity,
        effective_from: today,
        is_active: true,
      }));
      const { error } = await supabase.from("schedule_rules").insert(rows);
      if (error) throw error;
      await rematerialize();
    },
    onSuccess: invalidate,
  });

  const deactivateRule = useMutation({
    mutationFn: async (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("schedule_rules")
        .update({ is_active: false, effective_until: today })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    createRules,
    deactivateRule,
  };
}
