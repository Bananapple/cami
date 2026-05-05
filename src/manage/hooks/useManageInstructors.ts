import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type InstructorStatus = "active" | "on_leave" | "inactive";

export type ManagedInstructor = {
  id: string;
  display_name: string;
  last_name: string | null;
  initials: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  bio: string | null;
  image_url: string | null;
  is_active: boolean;
  status: InstructorStatus;
  platform_role: "manager" | "associate";
};

export function useManageInstructors() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["manage", "instructors", studioId] });

  const query = useQuery({
    queryKey: ["manage", "instructors", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<ManagedInstructor[]> => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, display_name, last_name, initials, email, phone, specialty, bio, image_url, is_active, status, platform_role")
        .eq("studio_id", studioId!)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ManagedInstructor[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<ManagedInstructor, "id" | "is_active">) => {
      const { error } = await supabase.from("instructors").insert({
        studio_id: studioId,
        ...input,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ManagedInstructor> & { id: string }) => {
      const { error } = await supabase.from("instructors").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("instructors").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    instructors: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    toggleActive,
  };
}
