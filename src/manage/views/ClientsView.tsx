import { useClientsView, type MemberSummary, type SegmentKey } from "../hooks/useClientsView";
import { useDrawerStack } from "../hooks/useDrawerStack";

function MembershipBadge({ member }: { member: MemberSummary }) {
  if (!member.membership_id) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
        No plan
      </span>
    );
  }

  if (member.plan_type === "subscription") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        {member.plan_name ?? "Subscription"}
      </span>
    );
  }

  const credits = member.credits_remaining ?? 0;
  if (credits === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        0 credits
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      {credits} credit{credits !== 1 ? "s" : ""}
    </span>
  );
}

function lastSeenLabel(lastBookingAt: string | null, joinedAt: string): string {
  if (!lastBookingAt) {
    const daysSinceJoin = Math.floor((Date.now() - new Date(joinedAt).getTime()) / 86_400_000);
    return `joined ${daysSinceJoin}d ago`;
  }
  const days = Math.floor((Date.now() - new Date(lastBookingAt).getTime()) / 86_400_000);
  if (days === 0) return "last visit today";
  if (days === 1) return "last visit 1d ago";
  return `last visit ${days}d ago`;
}

export function ClientsView() {
  const {
    isLoading,
    filtered,
    members,
    segments,
    segmentCounts,
    activeSegment,
    setActiveSegment,
  } = useClientsView();

  const { push } = useDrawerStack();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-serif">Clients</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? "Loading..." : `${activeSegment === "all" ? members.length : filtered.length} member${filtered.length !== 1 ? "s" : ""}`}
          {" · "}
          <span className="text-xs">use ⌘K to search</span>
        </p>
      </header>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2">
        {segments.map(({ key, label }) => {
          const count = segmentCounts[key] ?? 0;
          const isActive = activeSegment === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSegment(key as SegmentKey)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground/70 border-border hover:border-primary/50"
              }`}
            >
              {label}
              <span className={`ml-1.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Member list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No members in this segment.
        </p>
      ) : (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {filtered.map((member) => (
            <button
              key={member.user_id}
              onClick={() => push({ type: "member", id: member.user_id })}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                {(member.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <MembershipBadge member={member} />
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">
                    {member.total_sessions} session{member.total_sessions !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastSeenLabel(member.last_booking_at, member.joined_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
