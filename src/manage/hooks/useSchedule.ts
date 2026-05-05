import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type ScheduleClass = {
  id: string;
  rule_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  max_capacity: number;
  booked_count: number;
  price: number;
  notes: string | null;
  class_name: string;
  /** Template-derived level for the v2 CategoryChip (DATA-1) */
  level: string | null;
  template_id: string;
  instructor_id: string | null;
  instructor_name: string;
  location_id: string | null;
  location_name: string;
  location_timezone: string | null;
};

export type ClassTemplate = {
  id: string;
  name: string;
  level: string | null;
  default_duration_minutes: number;
  default_max_capacity: number;
  default_price: number;
};

export type Instructor = { id: string; display_name: string };
export type Location = { id: string; name: string; timezone: string | null };

export function useSchedule(weeksAhead = 4) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + weeksAhead * 7);

  const classesQuery = useQuery({
    queryKey: ["manage", "schedule", studioId, weeksAhead],
    enabled: !!studioId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<ScheduleClass[]> => {
      const { data, error } = await supabase
        .from("class_instances")
        .select(`
          id, rule_id, starts_at, ends_at, status, max_capacity, booked_count, price, notes,
          template_id, instructor_id, location_id,
          class_templates ( name, level ),
          instructors ( display_name ),
          locations ( name, timezone )
        `)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at");

      if (error) throw error;

      return (data ?? []).map((r: any) => ({
        id: r.id,
        rule_id: r.rule_id ?? null,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        status: r.status,
        max_capacity: r.max_capacity,
        booked_count: r.booked_count,
        price: r.price,
        notes: r.notes ?? null,
        class_name: r.class_templates?.name ?? "Class",
        level: r.class_templates?.level ?? null,
        template_id: r.template_id,
        instructor_id: r.instructor_id ?? null,
        instructor_name: r.instructors?.display_name ?? "—",
        location_id: r.location_id ?? null,
        location_name: r.locations?.name ?? "—",
        location_timezone: r.locations?.timezone ?? null,
      }));
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["manage", "class_templates", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<ClassTemplate[]> => {
      const { data, error } = await supabase
        .from("class_templates")
        .select("id, name, level, default_duration_minutes, default_max_capacity, default_price")
        .eq("studio_id", studioId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassTemplate[];
    },
  });

  const instructorsQuery = useQuery({
    queryKey: ["manage", "instructors", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<Instructor[]> => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, display_name")
        .eq("studio_id", studioId)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as Instructor[];
    },
  });

  const locationsQuery = useQuery({
    queryKey: ["manage", "locations", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<Location[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, timezone")
        .eq("studio_id", studioId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Location[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage", "schedule", studioId] });
    qc.invalidateQueries({ queryKey: ["manage", "today"] });
    qc.invalidateQueries({ queryKey: ["manage", "class"] });
  };

  const cancelClass = useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase
        .from("class_instances")
        .update({ status: "cancelled" })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateClass = useMutation({
    mutationFn: async ({
      id,
      max_capacity,
      instructor_id,
      location_id,
      price,
      starts_at,
      ends_at,
      notes,
    }: {
      id: string;
      max_capacity?: number;
      instructor_id?: string | null;
      location_id?: string | null;
      price?: number;
      starts_at?: string;
      ends_at?: string;
      notes?: string | null;
    }) => {
      // Build patch with only defined keys so we don't null out unset fields
      const patch: Record<string, unknown> = {};
      if (max_capacity !== undefined) patch.max_capacity = max_capacity;
      if (instructor_id !== undefined) patch.instructor_id = instructor_id;
      if (location_id !== undefined) patch.location_id = location_id;
      if (price !== undefined) patch.price = price;
      if (notes !== undefined) patch.notes = notes;
      if (starts_at !== undefined) {
        patch.starts_at = starts_at;
        if (ends_at !== undefined) {
          patch.ends_at = ends_at;
          patch.time_range = `[${starts_at},${ends_at})`;
        }
      }
      const { error } = await supabase
        .from("class_instances")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createClass = useMutation({
    mutationFn: async (input: {
      template_id: string;
      instructor_id: string | null;
      location_id: string | null;
      starts_at: string;
      duration_minutes: number;
      max_capacity: number;
      price: number;
    }) => {
      if (!studioId) throw new Error("No studio");
      const starts = new Date(input.starts_at);
      const ends = new Date(starts.getTime() + input.duration_minutes * 60_000);

      const { error } = await supabase.from("class_instances").insert({
        studio_id: studioId,
        template_id: input.template_id,
        instructor_id: input.instructor_id,
        location_id: input.location_id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        time_range: `[${starts.toISOString()},${ends.toISOString()})`,
        max_capacity: input.max_capacity,
        price: input.price,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    classes: classesQuery.data ?? [],
    isLoading: classesQuery.isLoading,
    error: classesQuery.error,
    templates: templatesQuery.data ?? [],
    instructors: instructorsQuery.data ?? [],
    locations: locationsQuery.data ?? [],
    cancelClass,
    updateClass,
    createClass,
  };
}
