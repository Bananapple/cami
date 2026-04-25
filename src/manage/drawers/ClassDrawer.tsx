import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { AttendanceList } from "../components/AttendanceList";
import { useStudioContext } from "@/context/StudioContext";
import { formatDateTime } from "@/lib/timezone";

type ClassDetail = {
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

function useClassInstance(id: string | undefined) {
  return useQuery({
    queryKey: ["manage", "class", id, "detail"],
    enabled: !!id,
    queryFn: async (): Promise<ClassDetail | null> => {
      const { data, error } = await supabase
        .from("class_instances")
        .select(`
          id, starts_at, ends_at, max_capacity, booked_count, status,
          class_templates ( name ),
          instructors ( display_name ),
          locations ( name, timezone )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        max_capacity: data.max_capacity,
        booked_count: data.booked_count,
        status: data.status,
        class_name: (data as any).class_templates?.name ?? "Class",
        instructor_name: (data as any).instructors?.display_name ?? "",
        location: (data as any).locations?.name ?? "",
        location_timezone: (data as any).locations?.timezone ?? null,
      };
    },
  });
}

export function ClassDrawer({
  classId,
  open,
  onOpenChange,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: cls, isLoading } = useClassInstance(classId);
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const tz = cls?.location_timezone ?? studioTz;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">
            {isLoading ? "Loading..." : cls?.class_name ?? "Class"}
          </SheetTitle>
        </SheetHeader>

        {!isLoading && cls && (
          <div className="mt-6 space-y-6">
            <section className="text-sm space-y-1">
              <p>
                {formatDateTime(cls.starts_at, tz, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </p>
              <p className="text-muted-foreground">
                {cls.instructor_name}
                {cls.location ? ` · ${cls.location}` : ""}
              </p>
              <p className="text-muted-foreground">
                {cls.booked_count} / {cls.max_capacity} booked · status: {cls.status}
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Attendance
              </h3>
              <AttendanceList classInstanceId={cls.id} />
            </section>

            <section className="space-y-2 pt-4 border-t border-border">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="text-sm py-2 border border-border rounded-md hover:bg-muted transition-colors"
                  disabled
                >
                  Cancel class
                </button>
                <button
                  className="text-sm py-2 border border-border rounded-md hover:bg-muted transition-colors"
                  disabled
                >
                  Add walk-in
                </button>
              </div>
              <p className="text-xs text-muted-foreground italic pt-2">
                Actions will be wired in V2.
              </p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
