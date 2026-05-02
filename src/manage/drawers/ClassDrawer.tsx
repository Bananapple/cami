import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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
  notes: string | null;
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
          id, starts_at, ends_at, max_capacity, booked_count, status, notes,
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
        notes: (data as any).notes ?? null,
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
  const qc = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage", "class", classId] });
    qc.invalidateQueries({ queryKey: ["manage", "schedule"] });
    qc.invalidateQueries({ queryKey: ["manage", "today"] });
  };

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("class_instances")
        .update({ status: "cancelled" })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Class cancelled."); onOpenChange(false); },
    onError: () => toast.error("Failed to cancel class."),
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: { max_capacity?: number; notes?: string | null }) => {
      const { error } = await supabase
        .from("class_instances")
        .update(patch)
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Updated."); },
    onError: () => toast.error("Failed to update."),
  });

  const isCancelled = cls?.status === "cancelled";

  return (
    <>
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
                <div className="flex items-center gap-3">
                  {editingCapacity ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = parseInt(capacityInput);
                        if (!isNaN(val) && val > 0) {
                          updateMutation.mutate({ max_capacity: val });
                        }
                        setEditingCapacity(false);
                      }}
                    >
                      <input
                        autoFocus
                        type="number"
                        value={capacityInput}
                        onChange={(e) => setCapacityInput(e.target.value)}
                        className="w-16 border border-border rounded px-2 py-0.5 text-sm"
                        min={cls.booked_count}
                      />
                      <span className="text-muted-foreground">/ max</span>
                      <button type="submit" className="text-xs text-primary">Save</button>
                      <button type="button" onClick={() => setEditingCapacity(false)} className="text-xs text-muted-foreground">Cancel</button>
                    </form>
                  ) : (
                    <p className="text-muted-foreground">
                      {cls.booked_count} / {cls.max_capacity} booked
                      {" · "}
                      <button
                        onClick={() => { setCapacityInput(String(cls.max_capacity)); setEditingCapacity(true); }}
                        className="text-primary text-xs hover:underline"
                        disabled={isCancelled}
                      >
                        edit capacity
                      </button>
                    </p>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isCancelled ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}>
                    {cls.status}
                  </span>
                </div>

                {/* Notes */}
                {editingNotes ? (
                  <div className="pt-1 space-y-1.5">
                    <textarea
                      autoFocus
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      rows={3}
                      placeholder="Internal notes…"
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { updateMutation.mutate({ notes: notesInput || null }); setEditingNotes(false); }}
                        className="text-xs text-primary"
                      >Save</button>
                      <button onClick={() => setEditingNotes(false)} className="text-xs text-muted-foreground">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs pt-0.5">
                    {cls.notes ?? ""}
                    <button
                      onClick={() => { setNotesInput(cls.notes ?? ""); setEditingNotes(true); }}
                      className="ml-2 text-primary hover:underline"
                      disabled={isCancelled}
                    >
                      {cls.notes ? "edit note" : "+ add note"}
                    </button>
                  </p>
                )}
              </section>

              <section className="pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Attendance
                </h3>
                <AttendanceList classInstanceId={cls.id} />
              </section>

              {!isCancelled && (
                <section className="space-y-2 pt-4 border-t border-border">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Actions</h3>
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="w-full text-sm py-2 border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    Cancel class
                  </button>
                  {cls.booked_count > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {cls.booked_count} member{cls.booked_count !== 1 ? "s" : ""} booked — you'll need to notify them and issue refunds manually.
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this class?</AlertDialogTitle>
            <AlertDialogDescription>
              {cls && (
                <>
                  <strong>{cls.class_name}</strong> on{" "}
                  {formatDateTime(cls.starts_at, tz, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })}.
                  {cls.booked_count > 0 && (
                    <> {cls.booked_count} member{cls.booked_count !== 1 ? "s" : ""} are booked — you'll need to contact them and issue refunds from their member cards.</>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep class</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
