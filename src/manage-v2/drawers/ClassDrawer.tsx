import { useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerSection, EditLink } from "../components/Drawer";
import { Button } from "../components/Button";
import { ConfirmModal } from "../components/ConfirmModal";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { Row } from "../components/Row";
import { OverflowMenu } from "../components/OverflowMenu";
import { EmptyState } from "../components/EmptyState";
import { AvatarCircle } from "../components/AvatarCircle";
import { LoadingPlaceholder } from "../components/LoadingPlaceholder";
import { useClassAttendance } from "@/manage/hooks/useClassAttendance";
import { useClassWaitlist } from "@/manage/hooks/useClassWaitlist";
import { useCancelClass } from "@/manage/hooks/useCancelClass";
import { useSubInstructor } from "@/manage/hooks/useSubInstructor";
import { useManageInstructors } from "@/manage/hooks/useManageInstructors";
import { useSchedule } from "@/manage/hooks/useSchedule";
import { useStudioContext } from "@/context/StudioContext";
import { supabase } from "@/integrations/supabase/client";
import { AddWalkInDrawer } from "./AddWalkInDrawer";
import { formatDate, formatTime } from "@/lib/timezone";
import type { ScheduleClass } from "@/manage/hooks/useSchedule";

type Tab = "attending" | "waitlist" | "cancelled" | "details";

export function ClassDrawerV2({
  cls,
  open,
  onClose,
  onMemberClick,
  onEditClass,
}: {
  cls: ScheduleClass | null;
  open: boolean;
  onClose: () => void;
  onMemberClick?: (userId: string) => void;
  onEditClass?: (classId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("attending");
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const { data: allAttendees = [], isLoading: attLoading, toggleCheckIn } = useClassAttendance(cls?.id);
  const { entries: waitlist, isLoading: wlLoading } = useClassWaitlist(cls?.id);
  const cancelClass = useCancelClass();
  const subInstructor = useSubInstructor();
  const { instructors } = useManageInstructors();
  const { updateClass } = useSchedule(4);
  const [subPickerOpen, setSubPickerOpen] = useState(false);
  const [pickedInstructorId, setPickedInstructorId] = useState<string>("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  if (!cls) return null;

  // Bucket statuses (consistent with the legacy ClassDrawer fix)
  const attending = allAttendees.filter((a) => a.status === "confirmed" || a.status === "pending");
  const cancelled = allAttendees.filter((a) => a.status === "cancelled");

  const tz = cls.location_timezone ?? studioTz;
  const dateStr = formatDate(cls.starts_at, tz, { weekday: "short", day: "numeric", month: "short" });
  const startStr = formatTime(cls.starts_at, tz);
  const endStr = formatTime(cls.ends_at, tz);

  const isCancelled = cls.status === "cancelled";
  const stateTone: "good" | "warn" | "bad" = isCancelled
    ? "bad"
    : cls.booked_count >= cls.max_capacity
    ? "warn"
    : "good";
  const stateLabel = isCancelled ? "Cancelled" : cls.booked_count >= cls.max_capacity ? "Full" : "Scheduled";

  return (
    <>
    <Drawer
      open={open}
      onClose={onClose}
      title={cls.class_name}
      subtitle={`${dateStr} · ${startStr} – ${endStr} · ${cls.instructor_name} · ${cls.location_name}`}
      headerMeta={
        <>
          <StateBadge tone={stateTone}>{stateLabel}</StateBadge>
          <CategoryChip>{cls.level ?? "All levels"}</CategoryChip>
          <Count value={`${cls.booked_count} / ${cls.max_capacity}`} label="booked" />
        </>
      }
      tabs={[
        { id: "attending", label: "Attending", count: attending.length },
        { id: "waitlist", label: "Waitlist", count: waitlist.length },
        { id: "cancelled", label: "Cancelled", count: cancelled.length },
        { id: "details", label: "Details" },
      ]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      actions={
        !isCancelled && (subPickerOpen ? (
          <SubInstructorBar
            instructors={instructors.filter((i) => i.status !== "inactive" && i.status !== "on_leave" && i.id !== cls.instructor_id)}
            value={pickedInstructorId}
            onChange={setPickedInstructorId}
            saving={subInstructor.isPending}
            onCancel={() => {
              setSubPickerOpen(false);
              setPickedInstructorId("");
            }}
            onSave={async () => {
              if (!pickedInstructorId) return;
              try {
                await subInstructor.mutateAsync({
                  class_instance_id: cls.id,
                  instructor_id: pickedInstructorId,
                });
                toast.success("Substitute instructor assigned");
                setSubPickerOpen(false);
                setPickedInstructorId("");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to assign substitute");
              }
            }}
          />
        ) : (
          <>
            <Button
              variant="danger"
              style={{ marginRight: "auto" }}
              disabled={cancelClass.isPending}
              onClick={() => setConfirmCancel(true)}
            >
              {cancelClass.isPending ? "Cancelling…" : "Cancel class"}
            </Button>
            <Button variant="ghost" onClick={() => setSubPickerOpen(true)}>
              Sub instructor
            </Button>
            <Button variant="primary" onClick={() => onEditClass?.(cls.id)}>
              Edit class
            </Button>
          </>
        ))
      }
    >
      {/* ── Attending tab ── */}
      {tab === "attending" && (
        <>
          <DrawerSection
            title="Notes"
            action={
              !notesEditing ? (
                <EditLink onClick={() => {
                  setNotesDraft(cls.notes ?? "");
                  setNotesEditing(true);
                }}>
                  {cls.notes ? "Edit" : "Add"}
                </EditLink>
              ) : undefined
            }
          >
            {notesEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Internal note for staff (e.g. props needed, instructor message)"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--ink)",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-input)",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotesEditing(false)}
                    disabled={updateClass.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={updateClass.isPending}
                    onClick={async () => {
                      try {
                        await updateClass.mutateAsync({
                          id: cls.id,
                          notes: notesDraft.trim() || null,
                        });
                        toast.success("Notes saved");
                        setNotesEditing(false);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to save notes");
                      }
                    }}
                  >
                    {updateClass.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : cls.notes ? (
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13, whiteSpace: "pre-wrap" }}>{cls.notes}</p>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13, fontStyle: "italic" }}>No notes for this class.</p>
            )}
          </DrawerSection>
          <DrawerSection
            title={`Attending · ${attending.length}`}
            action={<EditLink onClick={() => setWalkInOpen(true)}>Add walk-in</EditLink>}
            flush
          >
            {attLoading && <LoadingPlaceholder text="Loading attendees…" />}
            {!attLoading && attending.length === 0 && (
              <EmptyState title="No bookings yet" hint="Spots are open — share the schedule link with members." />
            )}
            {attending.map((a) => (
              <AttendeeRow
                key={a.booking_id}
                bookingId={a.booking_id}
                initials={initialsFor(a.full_name)}
                name={a.full_name}
                email={a.email}
                membership={!!a.membership_id}
                checkedIn={!!a.checked_in_at}
                onClick={() => onMemberClick?.(a.user_id)}
                onToggleCheckIn={() => toggleCheckIn.mutate({
                  booking_id: a.booking_id,
                  currently_checked_in: !!a.checked_in_at,
                })}
                onRemove={() => setConfirmRemove(a.booking_id)}
              />
            ))}
          </DrawerSection>
        </>
      )}

      {/* ── Waitlist tab ── */}
      {tab === "waitlist" && (
        <DrawerSection title={`Waitlist · ${waitlist.length}`} flush>
          {wlLoading && <LoadingPlaceholder text="Loading waitlist…" />}
          {!wlLoading && waitlist.length === 0 && (
            <EmptyState
              title="No one waiting"
              hint="Spots get offered automatically when a booking is cancelled."
            />
          )}
          {waitlist.map((w, i) => (
            <Row
              key={w.id}
              lead={
                <AvatarCircle>{initialsFor(w.full_name)}</AvatarCircle>
              }
              title={w.full_name ?? "Unknown"}
              meta={
                w.status === "offered"
                  ? `Offered ${relativeTime(w.joined_at)} ago — expires ${w.offer_expires_at ? relativeTime(w.offer_expires_at, true) : "soon"}`
                  : `In line · #${i + 1}`
              }
              trail={
                <StateBadge tone={w.status === "offered" ? "warn" : "neutral"}>
                  {w.status === "offered" ? "Offered" : "Waiting"}
                </StateBadge>
              }
              onSelect={() => onMemberClick?.(w.user_id)}
            />
          ))}
        </DrawerSection>
      )}

      {/* ── Cancelled tab ── */}
      {tab === "cancelled" && (
        <DrawerSection title={`Cancelled · ${cancelled.length}`} flush>
          {cancelled.length === 0 && (
            <EmptyState title="No cancellations" hint="Spots auto-released to the waitlist when members cancel." />
          )}
          {cancelled.map((a) => (
            <Row
              key={a.booking_id}
              lead={<AvatarCircle>{initialsFor(a.full_name)}</AvatarCircle>}
              title={
                <span style={{ color: "var(--ink-muted)", textDecoration: "line-through" }}>{a.full_name}</span>
              }
              meta={a.email ?? "—"}
              trail={<StateBadge tone="neutral">Cancelled</StateBadge>}
              onSelect={() => onMemberClick?.(a.user_id)}
            />
          ))}
        </DrawerSection>
      )}

      {/* ── Details tab ── */}
      {tab === "details" && (
        <DrawerSection>
          <KV label="Date" value={dateStr} />
          <KV label="Time" value={`${startStr} – ${endStr}`} />
          <KV label="Instructor" value={cls.instructor_name} />
          <KV label="Location" value={cls.location_name} />
          <KV label="Level" value={cls.level ?? "All levels"} />
          <KV label="Capacity" value={`${cls.booked_count} / ${cls.max_capacity}`} />
          <KV label="Drop-in price" value={`${cls.price} kr`} />
        </DrawerSection>
      )}

      <ConfirmModal
        open={confirmCancel}
        title="Cancel this class?"
        message={
          attending.length === 0
            ? `Cancel ${cls.class_name} on ${dateStr}? This cannot be undone.`
            : `Cancel ${cls.class_name} on ${dateStr}? ${attending.length} ${attending.length === 1 ? "booking" : "bookings"} will be cancelled. Refunds and credits are returned automatically.`
        }
        confirmLabel="Cancel class"
        variant="danger"
        loading={cancelClass.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={async () => {
          try {
            const res = await cancelClass.mutateAsync({ class_instance_id: cls.id });
            const parts: string[] = [];
            if (res.refunded) parts.push(`${res.refunded} refunded`);
            if (res.credits_returned) parts.push(`${res.credits_returned} credit${res.credits_returned === 1 ? "" : "s"} returned`);
            if (res.not_refunded) parts.push(`${res.not_refunded} inside window`);
            if (res.failed) parts.push(`${res.failed} failed`);
            toast.success(parts.length ? `Class cancelled · ${parts.join(", ")}` : "Class cancelled");
            if (res.failed) toast.error(`${res.failed} booking${res.failed === 1 ? "" : "s"} could not be processed — check manually.`);
            // Fire-and-forget: email affected members (non-blocking)
            supabase.functions.invoke("cancel-class-notify", { body: { class_instance_id: cls.id } });
            setConfirmCancel(false);
            onClose();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to cancel class");
          }
        }}
      />

      <ConfirmModal
        open={confirmRemove !== null}
        title="Remove attendee?"
        message="This will cancel their booking and free up the spot. Refunds and credits are returned automatically if outside the cancellation window."
        confirmLabel="Remove"
        variant="danger"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const bookingId = confirmRemove!;
          const attendee = attending.find((a) => a.booking_id === bookingId);
          const name = attendee?.full_name ?? "Attendee";
          setConfirmRemove(null);
          try {
            const { data, error } = await supabase.functions.invoke("issue-refund", {
              body: { booking_id: bookingId },
            });
            if (error) throw error;
            const d = data as { refunded?: boolean; credit_returned?: boolean; reason?: string };
            if (d?.refunded) toast.success(`${name} removed · refund issued`);
            else if (d?.credit_returned) toast.success(`${name} removed · credit returned`);
            else toast.success(`${name} removed${d?.reason === "inside_cancellation_window" ? " · inside refund window" : ""}`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to remove attendee");
          }
        }}
      />
    </Drawer>

    <AddWalkInDrawer
      classInstanceId={cls.id}
      className={cls.class_name}
      open={walkInOpen}
      onClose={() => setWalkInOpen(false)}
    />
    </>
  );
}

// ── Attendee row ───────────────────────────────────────────────────
function AttendeeRow({
  bookingId,
  initials,
  name,
  email,
  membership,
  checkedIn,
  onClick,
  onToggleCheckIn,
  onRemove,
}: {
  bookingId: string;
  initials: string;
  name: string;
  email: string | null;
  membership: boolean;
  checkedIn: boolean;
  onClick?: () => void;
  onToggleCheckIn: () => void;
  onRemove?: () => void;
}) {
  const handleAction = (id: string) => {
    if (id === "checkin" || id === "uncheck") {
      onToggleCheckIn();
    } else if (id === "remove") {
      onRemove?.();
    }
  };
  return (
    <Row
      lead={<AvatarCircle>{initials}</AvatarCircle>}
      title={name}
      meta={email ?? "—"}
      trail={
        <>
          {checkedIn && <StateBadge tone="good">Checked in</StateBadge>}
          {!checkedIn && (
            <StateBadge tone={membership ? "neutral" : "good"}>
              {membership ? "Membership" : "Paid"}
            </StateBadge>
          )}
          <OverflowMenu
            items={[
              { id: checkedIn ? "uncheck" : "checkin", label: checkedIn ? "Mark not arrived" : "Check in", group: 1 },
              { id: "remove", label: "Remove from class", group: 3, danger: true, dialog: true },
            ]}
            onAction={handleAction}
          />
        </>
      }
      onSelect={onClick}
    />
  );
}

// ── Inline sub-instructor picker (replaces actions row) ───────────
function SubInstructorBar({
  instructors,
  value,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  instructors: { id: string; display_name: string }[];
  value: string;
  onChange: (id: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ fontSize: 13, color: "var(--ink-muted)", marginRight: 4 }}>Sub with</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        style={{
          flex: 1,
          height: 32,
          padding: "0 10px",
          borderRadius: "var(--r-input)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          fontSize: 13,
          minWidth: 0,
        }}
      >
        <option value="">Select instructor…</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>{i.display_name}</option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button variant="primary" size="sm" onClick={onSave} disabled={!value || saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

// ── KV (matches Member information line items) ────────────────────
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "6px 0", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ color: "var(--ink)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(iso: string, future = false): string {
  const ms = future ? new Date(iso).getTime() - Date.now() : Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (Math.abs(min) < 1) return "now";
  if (Math.abs(min) < 60) return `${Math.abs(min)}m`;
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return `${Math.abs(h)}h`;
  const d = Math.round(h / 24);
  return `${Math.abs(d)}d`;
}
