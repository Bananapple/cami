import { useMemo, useState, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../shell/PageHeader";
import { useStickyBar } from "../lib/useStickyBar";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { OverflowMenu } from "../components/OverflowMenu";
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
  const { classes, isLoading } = useSchedule(4);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [editSequenceOpen, setEditSequenceOpen] = useState(false);

  const grouped = useMemo(() => groupByDay(classes ?? [], studioTz), [classes, studioTz]);
  const totalCount = classes?.length ?? 0;
  const activeClass = activeClassId ? classes?.find((c) => c.id === activeClassId) ?? null : null;
  const editingClass = editClassId ? classes?.find((c) => c.id === editClassId) ?? null : null;
  const headerRef = useRef<HTMLDivElement>(null);
  const showSticky = useStickyBar(headerRef);

  return (
    <>
      {/* Mobile sticky bar */}
      <div className={"sm-sticky-bar" + (showSticky ? " visible" : "")}>
        <span className="sm-sticky-bar-title">Schedule</span>
        <div className="sm-sticky-actions">
          <button type="button" className="sm-sticky-icon-btn" onClick={() => setEditSequenceOpen(true)}>
            <SlidersHorizontal size={14} />
          </button>
          <button type="button" className="sm-sticky-icon-btn" onClick={() => setAddClassOpen(true)}>
            +
          </button>
        </div>
      </div>

      <div ref={headerRef}>
        <PageHeader
          title="Schedule"
          subtitle={isLoading ? "Loading…" : `Next 4 weeks · ${totalCount} class${totalCount === 1 ? "" : "es"} scheduled`}
          actions={
            <>
              {/* Desktop: text buttons */}
              <Button variant="secondary" onClick={() => setEditSequenceOpen(true)} className="sm-hide-mobile">Edit sequence</Button>
              <Button variant="primary" onClick={() => setAddClassOpen(true)} className="sm-hide-mobile">+ Add one-off class</Button>
              {/* Mobile: compact icon buttons */}
              <button type="button" className="sm-hdr-icon-btn sm-hide-desktop" onClick={() => setEditSequenceOpen(true)}>
                <SlidersHorizontal size={15} />
              </button>
              <button type="button" className="sm-hdr-icon-btn sm-hdr-icon-btn--primary sm-hide-desktop" onClick={() => setAddClassOpen(true)}>
                +
              </button>
            </>
          }
        />
      </div>

      {!isLoading && grouped.length === 0 && (
        <RowList>
          <EmptyState
            title="No classes scheduled in the next 4 weeks"
            hint="Add a recurring schedule rule from the Studio settings, or create a one-off class above."
          />
        </RowList>
      )}

      {grouped.map(({ key, label, isToday, items }) => (
        <DayGroup key={key} label={label} isToday={isToday} count={items.length}>
          <RowList>
            {items.map((c) => (
              <ClassRow
                key={c.id}
                c={c}
                tz={c.location_timezone ?? studioTz}
                selected={activeClassId === c.id}
                onClick={() => setActiveClassId(c.id)}
                onEdit={() => setEditClassId(c.id)}
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

      {/* Nested member drawer (one nesting level allowed per spec) */}
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

// ── Day group header + content wrapper ─────────────────────────────
function DayGroup({
  label,
  isToday,
  count,
  children,
}: {
  label: string;
  isToday: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="sm-day">
      <div className="sm-day-head">
        <span className="label">
          {isToday && <span className="today">Today</span>}
          {label}
        </span>
        <span className="count">
          {count} class{count === 1 ? "" : "es"}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Row for a single class instance ────────────────────────────────
function ClassRow({
  c,
  tz,
  selected,
  onClick,
  onEdit,
}: {
  c: ScheduleClass;
  tz: string;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
}) {
  const fillRatio = c.max_capacity > 0 ? c.booked_count / c.max_capacity : 0;
  const isFull = c.booked_count >= c.max_capacity;
  const isCancelled = c.status === "cancelled";

  // Determine state badge
  const { tone, label } = (() => {
    if (isCancelled) return { tone: "bad" as const, label: "Cancelled" };
    if (isFull) return { tone: "warn" as const, label: "Full" };
    if (fillRatio < 0.3 && c.max_capacity > 0)
      return { tone: "warn" as const, label: `Low — ${c.booked_count}/${c.max_capacity}` };
    return { tone: "good" as const, label: "Confirmed" };
  })();

  // Level chip — DATA-1: render level, NOT discipline
  const levelLabel = c.level ?? "All levels";

  // Time as tabular mono
  const timeStr = formatTime(c.starts_at, tz);
  const durationMin = Math.max(1, Math.round((new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 60000));

  return (
    <Row
      lead={timeStr}
      title={c.class_name}
      titleSuffix={<CategoryChip>{levelLabel}</CategoryChip>}
      meta={`${c.instructor_name} · ${c.location_name} · ${durationMin} min`}
      trail={
        <>
          <Count value={`${c.booked_count} / ${c.max_capacity}`} tone={isFull ? "warn" : "default"} />
          <StateBadge tone={tone}>{label}</StateBadge>
          <OverflowMenu
            items={[
              { id: "edit", label: "Edit class", group: 1 },
              { id: "open", label: "Sub instructor / Cancel…", group: 1 },
            ]}
            onAction={(id) => {
              if (id === "edit") onEdit();
              else onClick();
            }}
          />
        </>
      }
      selected={selected}
      onSelect={onClick}
    />
  );
}

// ── Group classes by local-day ─────────────────────────────────────
type DayBucket = { key: string; label: string; isToday: boolean; items: ScheduleClass[] };

function groupByDay(classes: ScheduleClass[], tz: string): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const todayKey = dayKey(new Date(), tz);

  for (const c of classes) {
    const k = dayKey(new Date(c.starts_at), tz);
    if (!buckets.has(k)) {
      buckets.set(k, {
        key: k,
        label: formatDate(c.starts_at, tz, { weekday: "short", day: "numeric", month: "short" }),
        isToday: k === todayKey,
        items: [],
      });
    }
    buckets.get(k)!.items.push(c);
  }
  return Array.from(buckets.values());
}

function dayKey(d: Date, tz: string): string {
  // Stable YYYY-MM-DD in the studio's timezone
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}
