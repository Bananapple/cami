import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type PublicInstructor = {
  id: string;
  display_name: string;
  specialty: string | null;
  bio: string | null;
  image_url: string | null;
  class_names: string[];
};

export function usePublicInstructors() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const [instructors, setInstructors] = useState<PublicInstructor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!studioId) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const [{ data: insts, error: instsErr }, { data: rules, error: rulesErr }] = await Promise.all([
        supabase
          .from("instructors")
          .select("id, display_name, specialty, bio, image_url")
          .eq("studio_id", studioId)
          .eq("is_active", true)
          .order("display_name"),
        supabase
          .from("schedule_rules")
          .select("instructor_id, class_templates ( name )")
          .eq("studio_id", studioId)
          .eq("is_active", true),
      ]);

      if (cancelled) return;

      if (instsErr) { setError(new Error(instsErr.message)); setIsLoading(false); return; }
      if (rulesErr) { setError(new Error(rulesErr.message)); setIsLoading(false); return; }

      const classesByInstructor = new Map<string, Set<string>>();
      for (const r of (rules ?? []) as any[]) {
        if (!r.instructor_id) continue;
        if (!classesByInstructor.has(r.instructor_id)) {
          classesByInstructor.set(r.instructor_id, new Set());
        }
        const name = r.class_templates?.name;
        if (name) classesByInstructor.get(r.instructor_id)!.add(name);
      }

      setInstructors(
        (insts ?? []).map((i: any) => ({
          id: i.id,
          display_name: i.display_name,
          specialty: i.specialty ?? null,
          bio: i.bio ?? null,
          image_url: i.image_url ?? null,
          class_names: Array.from(classesByInstructor.get(i.id) ?? []).sort(),
        }))
      );
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [studioId]);

  return { instructors, isLoading, error };
}
