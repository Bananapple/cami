import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TodayClass = {
  id: string;
  starts_at: string;
  ends_at: string;
  max_capacity: number;
  booked_count: number;
  status: string;
  class_name: string;
  instructor_name: string;
  location: string;
  location_timezone: string | null;
};

export function useTodayClasses() {
  return useQuery({
    queryKey: ["manage", "today", "classes"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TodayClass[]> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase
        .from("class_instances")
        .select(`
          id, starts_at, ends_at, max_capacity, booked_count, status,
          class_templates ( name ),
          instructors ( display_name ),
          locations ( name, timezone )
        `)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at");

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        max_capacity: row.max_capacity,
        booked_count: row.booked_count,
        status: row.status,
        class_name: row.class_templates?.name ?? "Class",
        instructor_name: row.instructors?.display_name ?? "",
        location: row.locations?.name ?? "",
        location_timezone: row.locations?.timezone ?? null,
      }));
    },
  });
}
