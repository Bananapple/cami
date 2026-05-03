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
import { Check, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClassAttendance, attendanceQueryKey } from "../hooks/useClassAttendance";
import { useClassWaitlist } from "../hooks/useClassWaitlist";
import { useDrawerStack } from "../hooks/useDrawerStack";
import { useStudioContext } from "@/context/StudioContext";
import { formatDateTime } from "@/lib/timezone";

type ClassDetail = {
  id: string;
  rule_id: string | null;
  instructor_id: string | null;
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
          id, rule_id, instructor_id, starts_at, ends_at, max_capacity, booked_count, status, notes,
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
        rule_id: (data as any).rule_id ?? null,
        instructor_id: (data as any).instructor_id ?? null,
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

  const { data: allAttendees = [] } = useClassAttendance(cls?.id);
  const attending = allAttendees.filter((a) => a.status !== "cancelled");
  const cancelledBookings = allAttendees.filter((a) => a.status === "cancelled");
  const { entries: waitlist, remove: removeFromWaitlist } = useClassWaitlist(cls?.id);
  const { push } = useDrawerStack();

  type PeopleTab = "attending" | "waitlist" | "cancelled";
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("attending");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [subInstructorOpen, setSubInstructorOpen] = useState(false);
  const [subInstructorId, setSubInstructorId] = useState<string>("");

  const studioId = studioCtx?.studio?.id;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["manage", "class", classId] });
    qc.invalidateQueries({ queryKey: ["manage", "schedule"] });
    qc.invalidateQueries({ queryKey: ["manage", "today"] });
  };

  const { data: instructors = [] } = useQuery({
    queryKey: ["manage", "instructors", studioId],
    enabled: !!studioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("instructors")
        .select("id, display_name")
        .eq("studio_id", studioId!)
        .eq("is_active", true)
        .order("display_name");
      return (data ?? []) as { id: string; display_name: string }[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("class_instances")
        .update({ status: "cancelled" })
        .eq("id", classId);
      if (error) throw error;
      if (cls?.rule_id) {
        const exceptionDate = cls.starts_at.slice(0, 10);
        const { error: exErr } = await supabase.from("schedule_exceptions").upsert({
          studio_id: studioId,
          rule_id: cls.rule_id,
          exception_date: exceptionDate,
          kind: "cancel",
        }, { onConflict: "rule_id,exception_date" });
        if (exErr) throw exErr;
      }
    },
    onSuccess: () => { invalidate(); toast.success("Class cancelled."); onOpenChange(false); },
    onError: () => toast.error("Failed to cancel class."),
  });

  const subInstructorMutation = useMutation({
    mutationFn: async (newInstructorId: string) => {
      if (newInstructorId === cls?.instructor_id) return;
      const { error } = await supabase
        .from("class_instances")
        .update({ instructor_id: newInstructorId })
        .eq("id", classId);
      if (error) throw error;
      if (cls?.rule_id) {
        const exceptionDate = cls.starts_at.slice(0, 10);
        const { error: exErr } = await supabase.from("schedule_exceptions").upsert({
          studio_id: studioId,
          rule_id: cls.rule_id,
          exception_date: exceptionDate,
          kind: "sub_instructor",
          new_instructor_id: newInstructorId,
        }, { onConflict: "rule_id,exception_date" });
        if (exErr) throw exErr;
      }
    },
    onSuccess: () => { invalidate(); setSubInstructorOpen(false); toast.success("Instructor updated for this class."); },
    onError: () => toast.error("Failed to update instructor."),
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

              {/* Segmented people section */}
              <section className="pt-4 border-t border-border space-y-3">
                {/* Tab pills */}
                <div className="flex bg-muted rounded-lg p-1 gap-1">
                  {([
                    { key: "attending", label: "Attending", count: attending.length },
                    { key: "waitlist",  label: "Waitlist",  count: waitlist.length },
                    { key: "cancelled", label: "Cancelled", count: cancelledBookings.length },
                  ] as { key: PeopleTab; label: string; count: number }[]).map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setPeopleTab(key)}
                      className={`flex-1 py-1.5 rounded-md text-sm font-sans transition-colors ${
                        peopleTab === key
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label} {count > 0 && <span className="tabular-nums">{count}</span>}
                    </button>
                  ))}
                </div>

                {/* Attending */}
                {peopleTab === "attending" && (
                  attending.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No bookings yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {cls.ends_at < new Date().toISOString() && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm px-1">
                          <span className="text-green-600 font-medium">
                            {attending.filter((a) => a.checked_in_at).length} attended
                          </span>
                          {attending.filter((a) => !a.checked_in_at).length > 0 && (
                            <span className="text-amber-600">
                              · {attending.filter((a) => !a.checked_in_at).length} no-show
                            </span>
                          )}
                          {waitlist.length > 0 && (
                            <span className="text-muted-foreground">
                              · {waitlist.length} waitlisted
                            </span>
                          )}
                        </div>
                      )}
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                      {attending.map((a) => (
                        <AttendeeRow
                          key={a.booking_id}
                          attendee={a}
                          onNameClick={() => push({ type: "member", id: a.user_id })}
                          onCheckIn={async () => {
                            const nowOrNull = a.checked_in_at ? null : new Date().toISOString();
                            const { error } = await supabase
                              .from("bookings")
                              .update({ checked_in_at: nowOrNull })
                              .eq("id", a.booking_id);
                            if (error) { toast.error("Failed."); return; }
                            qc.invalidateQueries({ queryKey: attendanceQueryKey(cls.id) });
                          }}
                        />
                      ))}
                    </div>
                    </div>
                  )
                )}

                {/* Waitlist */}
                {peopleTab === "waitlist" && (
                  waitlist.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No one on the waitlist.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                        {waitlist.map((entry, i) => {
                          const isOffered = entry.status === "offered";
                          const expiresIn = entry.offer_expires_at
                            ? Math.max(0, Math.round((new Date(entry.offer_expires_at).getTime() - Date.now()) / 60_000))
                            : null;
                          return (
                            <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                              <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}.</span>
                              <button
                                onClick={() => push({ type: "member", id: entry.user_id })}
                                className="flex-1 min-w-0 text-left"
                              >
                                <p className="text-sm truncate hover:underline">{entry.full_name ?? "—"}</p>
                                <p className="text-xs text-muted-foreground truncate">{entry.email ?? ""}</p>
                              </button>
                              {isOffered ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 shrink-0">
                                  Offered{expiresIn !== null ? ` · ${expiresIn}m` : ""}
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                  Waiting
                                </span>
                              )}
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${entry.full_name ?? "this person"} from the waitlist?`)) return;
                                  try {
                                    await removeFromWaitlist.mutateAsync(entry.id);
                                    toast.success("Removed from waitlist.");
                                  } catch { toast.error("Failed to remove."); }
                                }}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">Spots offered automatically when a booking is cancelled.</p>
                    </div>
                  )
                )}

                {/* Cancelled */}
                {peopleTab === "cancelled" && (
                  cancelledBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No cancellations.</p>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                      {cancelledBookings.map((a) => (
                        <div key={a.booking_id} className="flex items-center gap-3 px-3 py-2.5 opacity-60">
                          <Avatar name={a.full_name} />
                          <button onClick={() => push({ type: "member", id: a.user_id })} className="flex-1 min-w-0 text-left">
                            <p className="text-sm truncate hover:underline line-through">{a.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.email ?? ""}</p>
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </section>

              {!isCancelled && (
                <section className="space-y-2 pt-4 border-t border-border">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Actions</h3>

                  {/* Sub instructor */}
                  {subInstructorOpen ? (
                    <div className="space-y-2">
                      <select
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                        value={subInstructorId || cls.instructor_id || ""}
                        onChange={(e) => setSubInstructorId(e.target.value)}
                      >
                        <option value="" disabled>Pick instructor…</option>
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>{inst.display_name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => subInstructorMutation.mutate(subInstructorId || cls.instructor_id || "")}
                          disabled={subInstructorMutation.isPending || !subInstructorId}
                          className="flex-1 text-sm py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
                        >
                          {subInstructorMutation.isPending ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => { setSubInstructorOpen(false); setSubInstructorId(""); }}
                          className="flex-1 text-sm py-1.5 border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSubInstructorId(cls.instructor_id ?? ""); setSubInstructorOpen(true); }}
                      className="w-full text-sm py-2 border border-border rounded-md hover:bg-muted transition-colors flex items-center justify-center gap-2"
                    >
                      <UserRound className="w-3.5 h-3.5" />
                      Sub instructor for this class
                    </button>
                  )}

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

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
      {initials}
    </div>
  );
}

function AttendeeRow({ attendee, onNameClick, onCheckIn }: {
  attendee: import("../hooks/useClassAttendance").Attendee;
  onNameClick: () => void;
  onCheckIn: () => void;
}) {
  const checkedIn = !!attendee.checked_in_at;
  const badge = attendee.membership_id
    ? { label: "Membership", cls: "bg-muted text-muted-foreground" }
    : { label: "Paid", cls: "bg-green-500/10 text-green-700" };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Avatar name={attendee.full_name} />
      <button onClick={onNameClick} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm truncate hover:underline">{attendee.full_name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-sans ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{attendee.email ?? ""}</p>
      </button>
      <button
        onClick={onCheckIn}
        title={checkedIn ? "Mark as not checked in" : "Check in"}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${
          checkedIn
            ? "bg-green-500/15 text-green-600 hover:bg-green-500/25"
            : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
        }`}
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
