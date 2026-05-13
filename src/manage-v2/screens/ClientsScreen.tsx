import { useMemo, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Row, RowList } from "../components/Row";
import { Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { AvatarCircle } from "../components/AvatarCircle";
import { LoadingPlaceholder } from "../components/LoadingPlaceholder";
import { MemberFilterBar } from "../components/MemberFilterBar";
import { useClientsView, type MemberSummary } from "@/manage/hooks/useClientsView";
import { MemberDrawerV2 } from "../drawers/MemberDrawer";
import { AddClientDrawer } from "../drawers/AddClientDrawer";

export function ClientsScreen() {
  const { isLoading, members, filtered, filter, setFilter } = useClientsView();

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);

  const newThisMonth = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return members.filter((m) => new Date(m.joined_at) >= monthStart).length;
  }, [members]);

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
          <button
            type="button"
            onClick={() => setAddClientOpen(true)}
            className="sm-btn sm ghost"
          >
            + Add client
          </button>
        }
      />

      <MemberFilterBar
        filter={filter}
        onChange={setFilter}
        members={members}
        filtered={filtered}
        onSelectMember={setActiveUserId}
      />

      <RowList>
        {isLoading && <LoadingPlaceholder text="Loading members…" />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            title={filter.text ? "No matches" : "No members yet"}
            hint={
              filter.text
                ? `Nothing matches "${filter.text}".`
                : "Add a client or wait for the first booking."
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
      trail={<Count value={member.total_sessions} label="visits" />}
      selected={selected}
      onSelect={onClick}
    />
  );
}

// ── Relative date helper ───────────────────────────────────────────
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
