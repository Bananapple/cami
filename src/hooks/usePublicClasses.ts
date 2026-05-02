import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type PublicClassRule = {
  day_of_week: number;
  start_time: string;
  instructor_name: string | null;
};

export type PublicClass = {
  id: string;
  name: string;
  level: string | null;
  description: string | null;
  image_url: string | null;
  default_duration_minutes: number;
  default_price: number;
  rules: PublicClassRule[];
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function collapseDays(days: number[]): string {
  const groups: number[][] = [];
  let current = [days[0]];
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] + 1) {
      current.push(days[i]);
    } else {
      groups.push(current);
      current = [days[i]];
    }
  }
  groups.push(current);
  return groups
    .map((g) =>
      g.length >= 3
        ? `${DAY_SHORT[g[0]]}–${DAY_SHORT[g[g.length - 1]]}`
        : g.map((d) => DAY_SHORT[d]).join(", ")
    )
    .join(", ");
}

export function formatSchedule(rules: PublicClassRule[]): string {
  if (rules.length === 0) return "";
  const byTime = new Map<string, number[]>();
  for (const r of rules) {
    const t = r.start_time.slice(0, 5);
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t)!.push(r.day_of_week);
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, days]) => {
      const sorted = [...new Set(days)].sort((a, b) => a - b);
      return `${collapseDays(sorted)} ${time}`;
    })
    .join(" · ");
}

export function usePublicClasses() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const [classes, setClasses] = useState<PublicClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studioId) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const [{ data: templates }, { data: rules }] = await Promise.all([
        supabase
          .from("class_templates")
          .select("id, name, level, description, image_url, default_duration_minutes, default_price")
          .eq("studio_id", studioId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("schedule_rules")
          .select("template_id, day_of_week, start_time, instructors ( display_name )")
          .eq("studio_id", studioId)
          .eq("is_active", true),
      ]);

      if (cancelled) return;

      const rulesByTemplate = new Map<string, PublicClassRule[]>();
      for (const r of (rules ?? []) as any[]) {
        if (!rulesByTemplate.has(r.template_id)) rulesByTemplate.set(r.template_id, []);
        rulesByTemplate.get(r.template_id)!.push({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          instructor_name: r.instructors?.display_name ?? null,
        });
      }

      setClasses(
        (templates ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          level: t.level,
          description: t.description,
          image_url: t.image_url,
          default_duration_minutes: t.default_duration_minutes,
          default_price: t.default_price,
          rules: rulesByTemplate.get(t.id) ?? [],
        }))
      );
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [studioId]);

  return { classes, isLoading };
}
