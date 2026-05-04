import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../shell/PageHeader";
import { Button } from "../components/Button";
import { StateBadge, Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { useSchedule, type ScheduleClass } from "@/manage/hooks/useSchedule";
import { useClassAttendance } from "@/manage/hooks/useClassAttendance";
import { useStudioContext } from "@/context/StudioContext";
import { formatDate, formatTime } from "@/lib/timezone";
import { bookingStatusBadge } from "../lib/bookingStatus";

export function TodayScreen() {
  const navigate = useNavigate();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const { classes, isLoading } = useSchedule(1);

  // Filter to today's classes (in studio timezone)
  const todayClasses = useMemo(() => {
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: studioTz });
    return classes.filter((c) => {
      const k = new Date(c.starts_at).toLocaleDateString("en-CA", { timeZone: studioTz });
      return k === todayKey;
    });
  }, [classes, studioTz]);

  // Auto-expand the "next up" class — the one whose start time is closest to now and not yet ended
  const nextUpId = useMemo(() => {
    const now = Date.now();
    const candidates = todayClasses.filter((c) => new Date(c.ends_at).getTime() > now);
    if (candidates.length === 0) return null;
    return candidates.sort(
      (a, b) => Math.abs(new Date(a.starts_at).getTime() - now) - Math.abs(new Date(b.starts_at).getTime() - now)
    )[0].id;
  }, [todayClasses]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Set initial expansion to next-up once classes load
  useEffect(() => {
    if (expandedId === null && nextUpId) setExpandedId(nextUpId);
  }, [nextUpId, expandedId]);

  const todayLabel = formatDate(new Date(), studioTz, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={
          isLoading
            ? "Loading…"
            : `${todayLabel} · ${todayClasses.length} class${todayClasses.length === 1 ? "" : "es"}`
        }
        actions={
          <Button variant="ghost" onClick={() => navigate("/_v2/schedule")}>
            View schedule
          </Button>
        }
      />

      {!isLoading && todayClasses.length === 0 && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--r-card)",
            background: "var(--surface)",
          }}
        >
          <EmptyState title="No classes today" hint="Enjoy the day off." />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {todayClasses.map((c) => (
          <ClassCard
            key={c.id}
            cls={c}
            tz={c.location_timezone ?? studioTz}
            expanded={expandedId === c.id}
            isNextUp={nextUpId === c.id}
            onToggle={() => setExpandedId((id) => (id === c.id ? null : c.id))}
          />
        ))}
      </div>
    </>
  );
}

// ── Class card (inline-expandable) ─────────────────────────────────
function ClassCard({
  cls,
  tz,
  expanded,
  isNextUp,
  onToggle,
}: {
  cls: ScheduleClass;
  tz: string;
  expanded: boolean;
  isNextUp: boolean;
  onToggle: () => void;
}) {
  const isPast = new Date(cls.ends_at).getTime() < Date.now();

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        background: "var(--surface)",
        opacity: isPast && !expanded ? 0.6 : 1,
        transition: "opacity 80ms",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 15,
            color: "var(--ink)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 56,
          }}
        >
          {formatTime(cls.starts_at, tz)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{cls.class_name}</span>
            {isNextUp && (
              <span
                style={{
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--action)",
                  background: "var(--action-soft)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                Next up
              </span>
            )}
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
            {cls.instructor_name} · {cls.location_name}
          </p>
        </div>
        <Count value={`${cls.booked_count} / ${cls.max_capacity}`} />
      </button>

      {expanded && <ClassAttendees cls={cls} />}
    </div>
  );
}

// ── Attendees list (loaded lazily on expansion) ────────────────────
function ClassAttendees({ cls }: { cls: ScheduleClass }) {
  const navigate = useNavigate();
  const { data: all = [], toggleCheckIn } = useClassAttendance(cls.id);

  // Show only attending (confirmed/pending), not cancelled/payment_failed
  const attendees = all.filter((a) => a.status === "confirmed" || a.status === "pending");
  const checkedInCount = attendees.filter((a) => a.checked_in_at).length;

  return (
    <div style={{ borderTop: "1px solid var(--line-soft)" }}>
      <div
        style={{
          padding: "10px 16px",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink-muted)",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Attending · {attendees.length}</span>
        <span style={{ color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
          {checkedInCount} / {attendees.length} checked in
        </span>
      </div>

      <div>
        {attendees.length === 0 && (
          <p style={{ padding: "16px", color: "var(--ink-muted)", fontSize: 13, textAlign: "center", margin: 0 }}>
            No bookings.
          </p>
        )}
        {attendees.map((a) => (
          <AttendeeRow
            key={a.booking_id}
            initials={initialsFor(a.full_name)}
            name={a.full_name}
            statusBadge={attendeeStatusBadge(a)}
            checkedIn={!!a.checked_in_at}
            disabled={a.status === "cancelled"}
            onToggle={() => toggleCheckIn.mutate({ booking_id: a.booking_id, currently_checked_in: !!a.checked_in_at })}
          />
        ))}
      </div>

      {/* Expansion footer — read-mostly per spec */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid var(--line-soft)",
          background: "var(--surface-2)",
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => alert("TODO: walk-in flow")}>
          Add walk-in
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/_v2/schedule?class=${cls.id}`)}>
          Class details
        </Button>
      </div>
    </div>
  );
}

// ── AttendeeRow with CheckCircle (44px hit area, 32px visible) ────
function AttendeeRow({
  initials,
  name,
  statusBadge,
  checkedIn,
  disabled,
  onToggle,
}: {
  initials: string;
  name: string;
  statusBadge: { tone: import("../components/Badge").StateBadgeTone; label: string } | null;
  checkedIn: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        borderBottom: "1px solid var(--line-soft)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        style={{
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
        }}
      >
        {initials}
      </span>
      <span style={{ fontSize: 14, color: "var(--ink)" }}>{name}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {statusBadge && <StateBadge tone={statusBadge.tone}>{statusBadge.label}</StateBadge>}
        <CheckCircle checked={checkedIn} disabled={disabled} onClick={onToggle} />
      </div>
    </div>
  );
}

// ── CheckCircle: 32px visible, 44px hit area ──────────────────────
function CheckCircle({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      aria-label={checked ? "Uncheck attendee" : "Check in attendee"}
      aria-pressed={checked}
      style={{
        width: 44,
        height: 44,
        padding: 6,
        background: "transparent",
        border: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: checked ? "var(--good)" : "transparent",
          border: `1.5px solid ${checked ? "var(--good)" : "var(--line-strong)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: checked ? "var(--action-on)" : "transparent",
          transition: "background 80ms, border-color 80ms",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5L6.5 11.5 12.5 4.5" />
        </svg>
      </span>
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function attendeeStatusBadge(a: { status: string; checked_in_at: string | null }) {
  // For Today, attendee badge focuses on payment/state — not Booked/Attended
  // because the CheckCircle already conveys check-in state.
  if (a.status === "confirmed") return null; // CheckCircle is the signal
  return bookingStatusBadge(a.status);
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
