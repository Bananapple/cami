import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, Plus } from "lucide-react";
import { PageHeader } from "../shell/PageHeader";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { useSchedule, type ScheduleClass } from "@/manage/hooks/useSchedule";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime } from "@/lib/timezone";
import { ClassDrawerV2 } from "../drawers/ClassDrawer";
import { MemberDrawerV2 } from "../drawers/MemberDrawer";
import { AddOneOffClassDrawer } from "../drawers/AddOneOffClassDrawer";
import { EditClassDrawer } from "../drawers/EditClassDrawer";
import { EditSequenceDrawer } from "../drawers/EditSequenceDrawer";

export function ScheduleScreen() {
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const { classes, isLoading } = useSchedule(4, 7);

  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [editSequenceOpen, setEditSequenceOpen] = useState(false);

  const todayKey = useMemo(() => dayKey(new Date(), studioTz), [studioTz]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const dayClasses = useMemo(
    () => (classes ?? []).filter((c) => dayKey(new Date(c.starts_at), studioTz) === selectedDateKey),
    [classes, selectedDateKey, studioTz],
  );

  const activeClass = activeClassId
    ? (classes ?? []).find((c) => c.id === activeClassId) ?? null
    : null;
  const editingClass = editClassId
    ? (classes ?? []).find((c) => c.id === editClassId) ?? null
    : null;

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return selectedDateKey === todayKey ? `Today · ${formatted}` : formatted;
  }, [selectedDateKey, todayKey]);

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={isLoading ? "Loading…" : selectedDateLabel}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setEditSequenceOpen(true)}
              title="Edit sequence"
            />
            <Button variant="primary" onClick={() => setAddClassOpen(true)}>
              <Plus size={13} />
              event
            </Button>
          </>
        }
      />

      <ScheduleDateStrip
        selectedDate={selectedDateKey}
        onSelect={setSelectedDateKey}
        classes={classes ?? []}
        tz={studioTz}
        isLoading={isLoading}
      />

      {!isLoading && dayClasses.length === 0 && (
        <RowList>
          <EmptyState
            title="No classes on this day"
            hint="Select another day above or add a one-off event."
          />
        </RowList>
      )}

      {dayClasses.length > 0 && (
        <RowList>
          {dayClasses.map((c) => (
            <ClassRow
              key={c.id}
              c={c}
              tz={c.location_timezone ?? studioTz}
              selected={activeClassId === c.id}
              onClick={() => setActiveClassId(c.id)}
            />
          ))}
        </RowList>
      )}

      <ClassDrawerV2
        cls={activeClass}
        open={!!activeClass}
        onClose={() => setActiveClassId(null)}
        onMemberClick={(uid) => setActiveMemberId(uid)}
        onEditClass={(id) => {
          setActiveClassId(null);
          setEditClassId(id);
        }}
      />

      <MemberDrawerV2
        userId={activeMemberId}
        open={!!activeMemberId}
        onClose={() => setActiveMemberId(null)}
      />

      <AddOneOffClassDrawer open={addClassOpen} onClose={() => setAddClassOpen(false)} />
      <EditClassDrawer
        cls={editingClass}
        open={!!editingClass}
        onClose={() => setEditClassId(null)}
      />
      <EditSequenceDrawer open={editSequenceOpen} onClose={() => setEditSequenceOpen(false)} />
    </>
  );
}

// ── Horizontal date strip with fill-rate bars ──────────────────────
// Sticky: stays frozen at top while the class list scrolls beneath.
// Center-on-select: clicking a chip smooth-scrolls it to the center of
// the strip — same pattern as the user booking flow DateStrip.
function ScheduleDateStrip({
  selectedDate,
  onSelect,
  classes,
  tz,
  isLoading,
}: {
  selectedDate: string;
  onSelect: (key: string) => void;
  classes: ScheduleClass[];
  tz: string;
  isLoading: boolean;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mountedRef = useRef(false);

  // 7 days before today + today + 28 days ahead = 36 chips
  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 36 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 7 + i);
      return d;
    });
  }, []);

  const todayKey = useMemo(() => dayKey(new Date(), tz), [tz]);

  // Aggregate fill rate per day from class data
  const fillMap = useMemo(() => {
    const map = new Map<string, { booked: number; capacity: number }>();
    for (const c of classes) {
      if (c.status === "cancelled") continue;
      const k = dayKey(new Date(c.starts_at), tz);
      const curr = map.get(k) ?? { booked: 0, capacity: 0 };
      curr.booked += c.booked_count;
      curr.capacity += c.max_capacity;
      map.set(k, curr);
    }
    return map;
  }, [classes, tz]);

  // Center the selected chip in the strip.
  // First call (mount): instant scroll to today.
  // Subsequent calls (user clicks): smooth scroll.
  useEffect(() => {
    const btn = buttonRefs.current[selectedDate];
    const strip = stripRef.current;
    if (!btn || !strip) return;

    const behavior = mountedRef.current ? "smooth" : "instant";
    mountedRef.current = true;

    const stripRect = strip.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const targetLeft =
      strip.scrollLeft +
      (btnRect.left + btnRect.width / 2) -
      (stripRect.left + stripRect.width / 2);

    strip.scrollTo({ left: Math.max(0, targetLeft), behavior });
  }, [selectedDate]);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 3,
        background: "var(--bg)",
        paddingTop: 10,
        paddingBottom: 12,
        marginTop: -10,
        // Subtle separator once the strip is stuck
        borderBottom: "1px solid var(--line-soft)",
        marginBottom: 16,
      }}
    >
      <div
        ref={stripRef}
        className="sm-scrollbar-none"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
        }}
      >
        {dates.map((d) => {
          const k = dayKey(d, tz);
          const isSelected = k === selectedDate;
          const isToday = k === todayKey;
          const fill = fillMap.get(k);
          const fillPct =
            fill && fill.capacity > 0
              ? Math.min(100, Math.round((fill.booked / fill.capacity) * 100))
              : null;

          const dayLabel = isToday
            ? "TODAY"
            : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);

          return (
            <button
              key={k}
              ref={(el) => { buttonRefs.current[k] = el; }}
              type="button"
              onClick={() => onSelect(k)}
              style={{
                flexShrink: 0,
                width: 58,
                padding: "8px 0 7px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                border: `1px solid ${isSelected ? "var(--action)" : "var(--line)"}`,
                borderRadius: "var(--r-card)",
                background: isSelected ? "var(--action)" : "var(--surface)",
                cursor: "pointer",
                transition: "background 80ms, border-color 80ms",
                fontFamily: "inherit",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.09em",
                  lineHeight: 1.4,
                  color: isSelected
                    ? "var(--action-on)"
                    : isToday
                    ? "var(--action)"
                    : "var(--ink-muted)",
                }}
              >
                {dayLabel}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  color: isSelected ? "var(--action-on)" : "var(--ink)",
                }}
              >
                {d.getDate()}
              </span>
              <span
                style={{
                  fontSize: 9,
                  lineHeight: 1.4,
                  color: isSelected ? "rgba(255,255,255,0.7)" : "var(--ink-muted)",
                }}
              >
                {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </span>
              {/* Fill-rate bar */}
              <div
                style={{
                  width: 36,
                  height: 3,
                  borderRadius: 2,
                  marginTop: 5,
                  background: isSelected ? "rgba(255,255,255,0.25)" : "var(--line)",
                  overflow: "hidden",
                }}
              >
                {!isLoading && fillPct !== null && (
                  <div
                    style={{
                      height: "100%",
                      width: `${fillPct}%`,
                      background: isSelected ? "var(--action-on)" : "var(--action)",
                      borderRadius: 2,
                    }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Row for a single class instance ────────────────────────────────
function ClassRow({
  c,
  tz,
  selected,
  onClick,
}: {
  c: ScheduleClass;
  tz: string;
  selected: boolean;
  onClick: () => void;
}) {
  const isFull = c.booked_count >= c.max_capacity;
  const isCancelled = c.status === "cancelled";

  const { tone, label } = (() => {
    if (isCancelled) return { tone: "bad" as const, label: "Cancelled" };
    if (isFull) return { tone: "warn" as const, label: "Full" };
    return { tone: "good" as const, label: "Scheduled" };
  })();

  const levelLabel = c.level ?? "All levels";
  const timeStr = formatTime(c.starts_at, tz);
  const durationMin = Math.max(
    1,
    Math.round(
      (new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 60000,
    ),
  );

  return (
    <Row
      lead={timeStr}
      title={c.class_name}
      titleSuffix={<CategoryChip variant="level">{levelLabel}</CategoryChip>}
      meta={`${c.instructor_name} · ${c.location_name} · ${durationMin} min`}
      trail={
        <div className="sm-trail-stack">
          <Count value={`${c.booked_count} / ${c.max_capacity}`} tone={isFull ? "warn" : "default"} />
          <StateBadge tone={tone}>{label}</StateBadge>
        </div>
      }
      selected={selected}
      onSelect={onClick}
    />
  );
}

// ── Day key: stable YYYY-MM-DD in studio timezone ──────────────────
function dayKey(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}
