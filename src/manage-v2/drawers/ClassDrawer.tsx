import { useState } from "react";
import { Drawer, DrawerSection, EditLink } from "../components/Drawer";
import { Button } from "../components/Button";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { Row } from "../components/Row";
import { OverflowMenu } from "../components/OverflowMenu";
import { EmptyState } from "../components/EmptyState";
import { useClassAttendance } from "@/manage/hooks/useClassAttendance";
import { useClassWaitlist } from "@/manage/hooks/useClassWaitlist";
import { useStudioContext } from "@/context/StudioContext";
import { formatDate, formatTime } from "@/lib/timezone";
import type { ScheduleClass } from "@/manage/hooks/useSchedule";

type Tab = "attending" | "waitlist" | "cancelled" | "details";

export function ClassDrawerV2({
  cls,
  open,
  onClose,
  onMemberClick,
}: {
  cls: ScheduleClass | null;
  open: boolean;
  onClose: () => void;
  onMemberClick?: (userId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("attending");
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const { data: allAttendees = [], isLoading: attLoading } = useClassAttendance(cls?.id);
  const { entries: waitlist, isLoading: wlLoading } = useClassWaitlist(cls?.id);

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
        !isCancelled && (
          <>
            <Button variant="danger" style={{ marginRight: "auto" }} onClick={() => alert("TODO: cancel class flow")}>
              Cancel class
            </Button>
            <Button variant="ghost" onClick={() => alert("TODO: sub instructor")}>
              Sub instructor
            </Button>
            <Button variant="primary" onClick={() => alert("TODO: edit class")}>
              Edit class
            </Button>
          </>
        )
      }
    >
      {/* ── Attending tab ── */}
      {tab === "attending" && (
        <>
          {cls.notes && (
            <DrawerSection title="Notes" action={<EditLink onClick={() => alert("TODO: edit notes")}>Edit</EditLink>}>
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>{cls.notes}</p>
            </DrawerSection>
          )}
          <DrawerSection
            title={`Attending · ${attending.length}`}
            action={<EditLink onClick={() => alert("TODO: add walk-in")}>Add walk-in</EditLink>}
            flush
          >
            {attLoading && <LoadingRow text="Loading attendees…" />}
            {!attLoading && attending.length === 0 && (
              <EmptyState title="No bookings yet" hint="Spots are open — share the schedule link with members." />
            )}
            {attending.map((a) => (
              <AttendeeRow
                key={a.booking_id}
                initials={initialsFor(a.full_name)}
                name={a.full_name}
                email={a.email}
                membership={!!a.membership_id}
                checkedIn={!!a.checked_in_at}
                onClick={() => onMemberClick?.(a.user_id)}
              />
            ))}
          </DrawerSection>
        </>
      )}

      {/* ── Waitlist tab ── */}
      {tab === "waitlist" && (
        <DrawerSection title={`Waitlist · ${waitlist.length}`} flush>
          {wlLoading && <LoadingRow text="Loading waitlist…" />}
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
                <span style={initialsStyle}>{initialsFor(w.full_name)}</span>
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
              lead={<span style={initialsStyle}>{initialsFor(a.full_name)}</span>}
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
    </Drawer>
  );
}

// ── Attendee row ───────────────────────────────────────────────────
function AttendeeRow({
  initials,
  name,
  email,
  membership,
  checkedIn,
  onClick,
}: {
  initials: string;
  name: string;
  email: string | null;
  membership: boolean;
  checkedIn: boolean;
  onClick?: () => void;
}) {
  return (
    <Row
      lead={<span style={initialsStyle}>{initials}</span>}
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
            onAction={(id) => alert("TODO: " + id)}
          />
        </>
      }
      onSelect={onClick}
    />
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

function LoadingRow({ text }: { text: string }) {
  return <p style={{ padding: "16px 20px", color: "var(--ink-muted)", fontSize: 13, margin: 0 }}>{text}</p>;
}

const initialsStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  color: "var(--ink-soft)",
  fontWeight: 500,
};

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
