import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Substitute the instructor on a single class instance. Conflict detection
// (instructor double-booking) is enforced at the DB level via an EXCLUDE
// USING GIST constraint on tstzrange — so an in-conflict update fails with
// PostgREST code 23P01. We surface that as a clean toast.

export class InstructorConflictError extends Error {
  constructor(msg = "That instructor is already teaching another class at this time.") {
    super(msg);
    this.name = "InstructorConflictError";
  }
}

export function useSubInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { class_instance_id: string; instructor_id: string }) => {
      const { error } = await supabase
        .from("class_instances")
        .update({ instructor_id: input.instructor_id })
        .eq("id", input.class_instance_id);
      if (error) {
        if (error.code === "23P01") throw new InstructorConflictError();
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage", "schedule"] });
      qc.invalidateQueries({ queryKey: ["manage", "today"] });
    },
  });
}
