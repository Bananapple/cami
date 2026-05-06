import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../shell/PageHeader";
import { Row, RowList } from "../components/Row";
import { StateBadge, Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { AvatarCircle } from "../components/AvatarCircle";
import { LoadingPlaceholder } from "../components/LoadingPlaceholder";
import { MemberFilterBar } from "../components/MemberFilterBar";
import {
  useClientsView,
  type SegmentKey,
  type MemberSummary,
  type TagFilter,
  type TagKey,
} from "@/manage/hooks/useClientsView";
import { getPlanHealth } from "../lib/planHealth";
import { MemberDrawerV2 } from "../drawers/MemberDrawer";
import { AddClientDrawer } from "../drawers/AddClientDrawer";
import { SegmentConfigDrawer } from "../drawers/SegmentConfigDrawer";
import { useMyStudioRole } from "@/manage/hooks/useMyStudioRole";

const TAG_KEYS: TagKey[] = ["plan", "frequency", "source", "time", "class"];

export function parseTagsParam(s: string | null): TagFilter[] {
  if (!s) return [];
  return s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [k, ...rest] = p.split(":");
      const key = k as TagKey;
      const value = rest.join(":");
      if (!TAG_KEYS.includes(key) || !value) return null;
      return { key, value };
    })
    .filter((t): t is TagFilter => t !== null);
}

export function serializeTags(tags: TagFilter[]): string {
  return tags.map((t) => `${t.key}:${t.value}`).join(",");
}

export function ClientsScreen() {
  // Read URL once on mount so useClientsView's initial filter matches deep-link
  // state (⌘K → /manage/clients?lifecycle=regular). Subsequent URL changes are
  // applied via the URL→filter effect below.
  const initialFilter = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      lifecycle: (params.get("lifecycle") as SegmentKey | null) ?? "all",
      tags: parseTagsParam(params.get("tags")),
      text: params.get("q") ?? "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useClientsView(initialFilter);
  const {
    isLoading,
    members,
    filtered,
    segmentCounts,
    tagCounts,
    classNames,
    filter,
    setFilter,
    setLifecycle,
    removeTag,
    popLastPill,
    config,
  } = view;

  const [searchParams, setSearchParams] = useSearchParams();

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { data: myRole } = useMyStudioRole();
  // segment_config UPDATE is gated to owners by RLS (studios_owner_update).
  // Don't show the Configure button to managers/instructors — they'd hit a
  // generic RLS-denied toast on save. Fail-closed in the UI.
  const canConfigureSegments = myRole === "owner";

  // Apply external URL changes after mount (e.g. ⌘K palette navigation while
  // the screen is already mounted). Initial mount is handled via initialFilter
  // above; the firstRunRef guard suppresses a redundant setFilter on the very
  // first effect pass.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    const lifecycle = (searchParams.get("lifecycle") as SegmentKey | null) ?? "all";
    const tags = parseTagsParam(searchParams.get("tags"));
    const text = searchParams.get("q") ?? "";
    setFilter({ lifecycle, tags, text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Mirror filter state back to URL so refresh / share-link preserves filters.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter.lifecycle !== "all") next.set("lifecycle", filter.lifecycle);
    else next.delete("lifecycle");
    if (filter.tags.length > 0) next.set("tags", serializeTags(filter.tags));
    else next.delete("tags");
    if (filter.text) next.set("q", filter.text);
    else next.delete("q");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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
        actions={
          <>
            {canConfigureSegments && (
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="sm-btn sm ghost"
              >
                Configure
              </button>
            )}
            <button
              type="button"
              onClick={() => setAddClientOpen(true)}
              className="sm-btn sm ghost"
            >
              + Add client
            </button>
          </>
        }
      />

      <MemberFilterBar
        filter={filter}
        onChange={setFilter}
        members={members}
        segmentCounts={segmentCounts}
        tagCounts={tagCounts}
        classNames={classNames}
        filtered={filtered}
        onSelectMember={setActiveUserId}
        onRemoveTag={removeTag}
        onPopPill={popLastPill}
        onSetLifecycle={setLifecycle}
      />

      <RowList>
        {isLoading && <LoadingPlaceholder text="Loading members…" />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            title={filter.text ? "No matches" : "No members in this view"}
            hint={
              filter.text
                ? `Nothing matches "${filter.text}".`
                : "Remove a filter pill to widen the search."
            }
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

      <SegmentConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
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

  const planHealth = getPlanHealth(member);

  const lastVisit = member.last_booking_at ? relativeDate(member.last_booking_at) : "never";

  return (
    <Row
      lead={<AvatarCircle>{initials}</AvatarCircle>}
      title={member.full_name}
      meta={
        <>
          {member.email ?? "—"}
          <span className="sm-hide-mobile"> · last visit {lastVisit}</span>
        </>
      }
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
