import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { useClientsView, type SegmentKey, type MemberSummary } from "@/manage/hooks/useClientsView";
import { getPlanHealth } from "../lib/planHealth";
import { MemberDrawerV2 } from "../drawers/MemberDrawer";
import { AddClientDrawer } from "../drawers/AddClientDrawer";

export function ClientsScreen() {
  const {
    isLoading,
    members,
    filtered,
    segmentCounts,
    segments,
    search,
    setSearch,
    activeSegment,
    setActiveSegment,
  } = useClientsView();

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const newThisMonth = members.filter((m) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return new Date(m.joined_at) >= monthStart;
  }).length;

  return (
    <>
      <PageHeader
          title="Clients"
          subtitle={
            isLoading
              ? "Loading…"
              : `${members.length} member${members.length === 1 ? "" : "s"} · ${newThisMonth} new this month`
          }
        />

      {/* Segments */}
      <div className="sm-segments">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            className={"sm-segment " + (activeSegment === s.key ? "on" : "")}
            onClick={() => setActiveSegment(s.key as SegmentKey)}
          >
            {s.label} <span className="ct">{segmentCounts[s.key as SegmentKey] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search + Add client (right-aligned, matches Studio "+ Add product" pattern) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{
            width: "100%",
            maxWidth: 320,
            height: 32,
            padding: "0 12px",
            fontSize: 13,
            color: "var(--ink)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-input)",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => setAddClientOpen(true)}
          className="sm-btn sm ghost"
        >
          + Add client
        </button>
      </div>

      <RowList>
        {isLoading && (
          <div style={{ padding: "16px 14px", color: "var(--ink-muted)", fontSize: 13 }}>Loading members…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            title={search ? "No matches" : "No members in this segment"}
            hint={search ? `Nothing matches "${search}".` : "Switch segments above to see other groups."}
          />
        )}
        {filtered.map((m) => (
          <MemberRow
            key={m.user_id}
            member={m}
            selected={activeUserId === m.user_id}
            onClick={() => setActiveUserId(m.user_id)}
          />
        ))}
      </RowList>

      <MemberDrawerV2
        userId={activeUserId}
        open={!!activeUserId}
        onClose={() => setActiveUserId(null)}
      />

      <AddClientDrawer open={addClientOpen} onClose={() => setAddClientOpen(false)} />
    </>
  );
}

// ── Member row ─────────────────────────────────────────────────────
function MemberRow({
  member,
  selected,
  onClick,
}: {
  member: MemberSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = (member.full_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // DATA-2: trailing badge = plan health, plan name on meta-line
  const planHealth = getPlanHealth(member);

  const lastVisit = member.last_booking_at
    ? relativeDate(member.last_booking_at)
    : "never";

  // Plan name on the meta-line (alongside email + last visit)
  const planMeta = member.plan_name ? ` · ${member.plan_name}` : "";
  const meta = `${member.email ?? "—"} · last visit ${lastVisit}${planMeta}`;

  return (
    <Row
      lead={
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
      }
      title={member.full_name}
      meta={meta}
      trail={
        <>
          <Count value={member.total_sessions} label="visits" />
          <StateBadge tone={planHealth.tone}>{planHealth.label}</StateBadge>
        </>
      }
      selected={selected}
      onSelect={onClick}
    />
  );
}

// ── Relative date helper (e.g. "3 days ago") ───────────────────────
function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
