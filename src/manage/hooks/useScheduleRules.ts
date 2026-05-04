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
    if (!studioId) return;
    const today = new Date().toISOString().slice(0, 10);
    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await supabase.rpc("materialize_class_instances" as any, {
      _studio_id: studioId,
      _from: today,
      _to: ninetyDays,
    });
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

  // Single-time-slot insert. Each call creates one rule for one day at one time.
  const addRule = useMutation({
    mutationFn: async (input: {
      template_id: string;
      day_of_week: number;
      start_time: string; // "HH:MM"
      duration_minutes: number;
      max_capacity: number;
      price: number;
      instructor_id: string | null;
      location_id: string | null;
    }) => {
      if (!studioId) throw new Error("No studio");
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("schedule_rules").insert({
        studio_id: studioId,
        template_id: input.template_id,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        duration_minutes: input.duration_minutes,
        max_capacity: input.max_capacity,
        price: input.price,
        instructor_id: input.instructor_id,
        location_id: input.location_id,
        effective_from: today,
        is_active: true,
      });
      if (error) throw error;
      await rematerialize();
    },
    onSuccess: invalidate,
  });

  // Patch a single field on a rule (e.g. start_time when the user edits a chip).
  const updateRule = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<ScheduleRule, "start_time" | "duration_minutes" | "max_capacity" | "price" | "instructor_id" | "location_id">>) => {
      const { error } = await supabase.from("schedule_rules").update(patch).eq("id", id);
      if (error) throw error;
      await rematerialize();
    },
    onSuccess: invalidate,
  });

  // Cancel a single time slot. Soft-deletes the rule AND deletes any
  // already-materialized future un-booked instances tied to it. Booked
  // instances are kept so the manager can handle them manually.
  const cancelRule = useMutation({
    mutationFn: async (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      // 1. Deactivate
      const { error: e1 } = await supabase
        .from("schedule_rules")
        .update({ is_active: false, effective_until: today })
        .eq("id", id);
      if (e1) throw e1;

      // 2. Delete future un-booked instances for this rule
      // We use booked_count as the proxy (matches the materializer's guard).
      const { error: e2 } = await supabase
        .from("class_instances")
        .delete()
        .eq("rule_id", id)
        .gte("starts_at", new Date().toISOString())
        .eq("status", "scheduled")
        .eq("booked_count", 0);
      if (e2) throw e2;
    },
    onSuccess: invalidate,
  });

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    createRules,
    deactivateRule,
    addRule,
    updateRule,
    cancelRule,
  };
}
