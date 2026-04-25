import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";
import { formatDateTime } from "@/lib/timezone";

export type CommandResult =
  | { kind: "member"; id: string; label: string; subtitle: string }
  | { kind: "class"; id: string; label: string; subtitle: string };

export function useCommandSearch(query: string) {
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  return useQuery({
    queryKey: ["manage", "search", query, studioTz],
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<CommandResult[]> => {
      const term = `%${query.trim()}%`;

      const [memberRes, classRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .or(`full_name.ilike.${term},email.ilike.${term}`)
          .limit(8),
        supabase
          .from("class_instances")
          .select(`
            id, starts_at,
            class_templates ( name ),
            locations ( timezone )
          `)
          .gte("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .lte("starts_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(20),
      ]);

      const members: CommandResult[] = (memberRes.data ?? []).map((m: any) => ({
        kind: "member",
        id: m.id,
        label: m.full_name ?? "Unknown",
        subtitle: m.email ?? "",
      }));

      const classes: CommandResult[] = (classRes.data ?? [])
        .filter((c: any) =>
          (c.class_templates?.name ?? "").toLowerCase().includes(query.trim().toLowerCase())
        )
        .map((c: any) => {
          const tz = c.locations?.timezone ?? studioTz;
          return {
            kind: "class",
            id: c.id,
            label: c.class_templates?.name ?? "Class",
            subtitle: formatDateTime(c.starts_at, tz, {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
          };
        });

      return [...members, ...classes].slice(0, 12);
    },
  });
}
