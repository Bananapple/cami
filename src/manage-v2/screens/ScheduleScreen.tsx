import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, Plus } from "lucide-react";
import { PageHeader } from "../shell/PageHeader";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { useSchedule, type ScheduleClass } from "@/manage/hooks/useSchedule";
import { useStudioContext } from "@/context/StudioContext";
import { formatDate, formatTime } from "@/lib/timezone";
import { ClassDrawerV2 } from "../drawers/ClassDrawer";
import { MemberDrawerV2 } from "../drawers/MemberDrawer";
import { AddOneOffClassDrawer } from "../drawers/AddOneOffClassDrawer";
import { EditClassDrawer } from "../drawers/EditClassDrawer";
import { EditSequenceDrawer } from "../drawers/EditSequenceDrawer";

export function ScheduleScreen() {
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const { classes, isLoading } = useSchedule(4, 30);

  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [editSequenceOpen, setEditSequenceOpen] = useState(false);

  const todayKey = useMemo(() => dayKey(new Date(), studioTz), [studioTz]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  // Ref copy so scroll handler always sees the latest value without re-registering
  const selectedDateRef = useRef(selectedDateKey);
  selectedDateRef.current = selectedDateKey;

  // All days with classes, grouped (continuous scroll — no day filter)
  const grouped = useMemo(() => groupByDay(classes ?? [], studioTz), [classes, studioTz]);

  const activeClass = activeClassId
    ? (classes ?? []).find((c) => c.id === activeClassId) ?? null
    : null;
  const editingClass = editClassId
    ? (classes ?? []).find((c) => c.id === editClassId) ?? null
    : null;

  // Refs for each day-section header so we can scroll-to and observe
  const dayGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stickyRef = useRef<HTMLDivElement>(null);
  // Suppress observer while a programmatic scroll is in flight
  const clickScrollingRef = useRef(false);

  // ── Scroll → chip: track which day is at the top of the viewport ──
  useEffect(() => {
    const container = document.querySelector(".sm-content") as HTMLElement | null;
    if (!container) return;

    const onScroll = () => {
      if (clickScrollingRef.current) return;
      const stripBottom =
        container.getBoundingClientRect().top + (stickyRef.current?.offsetHeight ?? 90) + 12;

      // Find the last day header whose top edge is at or above the trigger line
      let active: string | null = null;
      for (const [key, el] of Object.entries(dayGroupRefs.current)) {
        if (!el) continue;
        if (el.getBoundingClientRect().top <= stripBottom) active = key;
      }
      if (active && active !== selectedDateRef.current) {
        setSelectedDateKey(active);
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []); // register once; handler reads mutable refs

  // ── Chip → scroll: smooth-scroll content to that day's section ────
  const handleChipSelect = useCallback((key: string) => {
    setSelectedDateKey(key);
    const el = dayGroupRefs.current[key];
    if (!el) return; // empty day — just highlight chip, no scroll

    const container = document.querySelector(".sm-content") as HTMLElement | null;
    if (!container) return;

    clickScrollingRef.current = true;
    const stripHeight = stickyRef.current?.offsetHeight ?? 90;
    const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top - stripHeight - 8;
    container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
    setTimeout(() => { clickScrollingRef.current = false; }, 1000);
  }, []);

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
      {/* Frozen header: title + date strip stay pinned while class list scrolls */}
      <div
        ref={stickyRef}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 3,
          background: "var(--bg)",
          paddingBottom: 12,
          marginBottom: 16,
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
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
          onSelect={handleChipSelect}
          classes={classes ?? []}
          tz={studioTz}
          isLoading={isLoading}
        />
      </div>

      {!isLoading && grouped.length === 0 && (
        <RowList>
          <EmptyState
            title="No classes scheduled in this window"
            hint="Add a recurring schedule rule from Studio settings, or create a one-off event above."
          />
        </RowList>
      )}

      {grouped.map(({ key, label, isToday, items }) => (
        <DayGroup
          key={key}
          label={label}
          isToday={isToday}
          count={items.length}
          sectionRef={(el) => { dayGroupRefs.current[key] = el; }}
        >
          <RowList>
            {items.map((c) => (
              <ClassRow
                key={c.id}
                c={c}
                tz={c.location_timezone ?? studioTz}
                selected={activeClassId === c.id}
                onClick={() => setActiveClassId(c.id)}
              />
            ))}
          </RowList>
        </DayGroup>
      ))}

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

  // 30 days back + today + 28 days ahead = 59 chips
  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 59 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 30 + i);
      return d;
    });
  }, []);

  const todayKey = useMemo(() => dayKey(new Date(), tz), [tz]);

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

  // Center selected chip — instant on mount, smooth thereafter
  useEffect(() => {
    const btn = buttonRefs.current[selectedDate];
    const strip = stripRef.current;
    if (!btn || !strip) return;
    const behavior = mountedRef.current ? "smooth" : "instant";
    mountedRef.current = true;
    const stripRect = strip.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const target =
      strip.scrollLeft +
      (btnRect.left + btnRect.width / 2) -
      (stripRect.left + stripRect.width / 2);
    strip.scrollTo({ left: Math.max(0, target), behavior });
  }, [selectedDate]);

  return (
    <div ref={stripRef} className="sm-scrollbar-none" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
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
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.09em", lineHeight: 1.4, color: isSelected ? "var(--action-on)" : isToday ? "var(--action)" : "var(--ink-muted)" }}>
                {dayLabel}
              </span>
              <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em", color: isSelected ? "var(--action-on)" : "var(--ink)" }}>
                {d.getDate()}
              </span>
              <span style={{ fontSize: 9, lineHeight: 1.4, color: isSelected ? "rgba(255,255,255,0.7)" : "var(--ink-muted)" }}>
                {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </span>
              <div style={{ width: 36, height: 3, borderRadius: 2, marginTop: 5, background: isSelected ? "rgba(255,255,255,0.25)" : "var(--line)", overflow: "hidden" }}>
                {!isLoading && fillPct !== null && (
                  <div style={{ height: "100%", width: `${fillPct}%`, background: isSelected ? "var(--action-on)" : "var(--action)", borderRadius: 2 }} />
                )}
              </div>
            </button>
          );
        })}
    </div>
  );
}

// ── Day group header + class list ──────────────────────────────────
function DayGroup({
  label,
  isToday,
  count,
  children,
  sectionRef,
}: {
  label: string;
  isToday: boolean;
  count: number;
  children: React.ReactNode;
  sectionRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="sm-day">
      <div ref={sectionRef} className="sm-day-head">
        <span className="label">
          {isToday && <span className="today">Today</span>}
          {label}
        </span>
        <span className="count">{count} class{count === 1 ? "" : "es"}</span>
      </div>
      {children}
    </div>
  );
}

// ── Row for a single class instance ───────────────────────────────
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
  const timeStr = formatTime(c.starts_at, tz);
  const durationMin = Math.max(
    1,
    Math.round((new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 60000),
  );
  return (
    <Row
      lead={timeStr}
      title={c.class_name}
      titleSuffix={<CategoryChip variant="level">{c.level ?? "All levels"}</CategoryChip>}
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

// ── Helpers ────────────────────────────────────────────────────────
type DayBucket = { key: string; label: string; isToday: boolean; items: ScheduleClass[] };

function groupByDay(classes: ScheduleClass[], tz: string): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const todayK = dayKey(new Date(), tz);
  for (const c of classes) {
    const k = dayKey(new Date(c.starts_at), tz);
    if (!buckets.has(k)) {
      buckets.set(k, {
        key: k,
        label: formatDate(c.starts_at, tz, { weekday: "short", day: "numeric", month: "short" }),
        isToday: k === todayK,
        items: [],
      });
    }
    buckets.get(k)!.items.push(c);
  }
  return Array.from(buckets.values());
}

function dayKey(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}
