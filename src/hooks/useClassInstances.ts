import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

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
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const studioTimezone = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  // Anchor the 14-day window to the studio's timezone, not the user's browser.
  // Using sv-SE locale gives ISO 8601-style dates without library dependencies.
  const nowInStudio = new Date(
    new Date().toLocaleString("sv-SE", { timeZone: studioTimezone })
  );
  const fromDate = new Date(nowInStudio);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 14);

  const fromISO = fromDate.toISOString();
  const toISO = toDate.toISOString();

  const { data: instances = [], isLoading, error } = useQuery({
    // Include studioId + date range in the key so the cache invalidates at midnight
    // and when the studio context changes.
    queryKey: ["class_instances", studioId, fromISO, toISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_instances")
        .select(`
          id, studio_id, starts_at, ends_at, price, max_capacity, booked_count, status,
          class_templates ( name, level ),
          instructors ( display_name, initials ),
          locations ( name, timezone )
        `)
        .eq("status", "scheduled")
        .gte("starts_at", fromISO)
        .lt("starts_at", toISO)
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

  return { instances, isLoading, error };
}
