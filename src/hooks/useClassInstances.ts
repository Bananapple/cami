import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClassInstance = {
  id: string;
  studio_id: string;
  starts_at: string;
  ends_at: string;
  price: number;
  max_capacity: number;
  booked_count: number;
  status: string;
  class_name: string;
  level: string;
  practitioner_name: string;
  practitioner_initials: string;
  location: string;
  location_timezone: string | null;
};

export function useClassInstances() {
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["class_instances"],
    queryFn: async () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 14);

      const { data, error } = await supabase
        .from("class_instances")
        .select(`
          id, studio_id, starts_at, ends_at, price, max_capacity, booked_count, status,
          class_templates ( name, level ),
          instructors ( display_name, initials ),
          locations ( name, timezone )
        `)
        .eq("status", "scheduled")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .order("starts_at");

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        studio_id: row.studio_id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        price: Number(row.price),
        max_capacity: row.max_capacity,
        booked_count: row.booked_count,
        status: row.status,
        class_name: row.class_templates?.name ?? "",
        level: row.class_templates?.level ?? "",
        practitioner_name: row.instructors?.display_name ?? "",
        practitioner_initials: row.instructors?.initials ?? "",
        location: row.locations?.name ?? "",
        location_timezone: row.locations?.timezone ?? null,
      })) as ClassInstance[];
    },
  });

  return { instances, isLoading };
}
