import { useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import type { ClassInstance } from "@/hooks/useClassInstances";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime, toDateString } from "@/lib/timezone";

interface SessionFeedProps {
  sessions: ClassInstance[];
  onSelectSession: (session: ClassInstance) => void;
  onVisibleDateChange: (date: Date) => void;
  registerScrollFn: (fn: (date: Date) => void) => void;
}

const avatarColors = [
  "bg-primary/20 text-primary",
  "bg-accent/20 text-accent",
  "bg-terracotta-500/20 text-terracotta-700",
  "bg-warm-olive/20 text-warm-olive",
  "bg-secondary text-secondary-foreground",
];

const SessionFeed = ({ sessions, onSelectSession, onVisibleDateChange, registerScrollFn }: SessionFeedProps) => {
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const dateGroups = useMemo(() => {
    const map = new Map<string, { date: Date; sessions: ClassInstance[] }>();
    for (const s of sessions) {
      const dateStr = toDateString(s.starts_at, studioTz);
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: new Date(dateStr + "T00:00:00"), sessions: [] });
      }
      map.get(dateStr)!.sessions.push(s);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, g]) => g.sessions.length > 0);
  }, [sessions, studioTz]);

  const updateVisibleDate = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let activeDate: string | null = null;
    for (const [dateStr] of dateGroups) {
      const el = sectionRefs.current[dateStr];
      if (!el) continue;
      const elTop = el.getBoundingClientRect().top - containerTop;
      if (elTop <= 48) {
        activeDate = dateStr;
      }
    }
    if (activeDate) {
      onVisibleDateChange(new Date(activeDate + "T00:00:00"));
    }
  }, [dateGroups, onVisibleDateChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", updateVisibleDate, { passive: true });
    return () => container.removeEventListener("scroll", updateVisibleDate);
  }, [updateVisibleDate]);

  useEffect(() => {
    registerScrollFn((date: Date) => {
      const dateStr = toDateString(date, studioTz);
      const el = sectionRefs.current[dateStr];
      const container = containerRef.current;
      if (el && container) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - 8;
        container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      }
    });
  }, [registerScrollFn, studioTz]);

  if (dateGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-sm text-muted-foreground font-serif text-center">
          No upcoming sessions in the next two weeks.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0 px-6 pb-8">
      <div className="space-y-6 pt-4">
        {dateGroups.map(([dateStr, { date, sessions: daySessions }], groupIndex) => {
          const dateLabel = date.toLocaleDateString("nb-NO", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          const offset = dateGroups
            .slice(0, groupIndex)
            .reduce((sum, [, g]) => sum + g.sessions.length, 0);

          return (
            <section
              key={dateStr}
              ref={(el) => { sectionRefs.current[dateStr] = el; }}
              className="space-y-2"
            >
              <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground/70 pb-1">
                {dateLabel}
              </p>
              <div className="space-y-2">
                {daySessions.map((session, i) => {
                  const tz = session.location_timezone ?? studioTz;
                  const spotsLeft =
                    session.max_capacity > 0
                      ? session.max_capacity - session.booked_count
                      : null;
                  const isFull = spotsLeft !== null && spotsLeft <= 0;
                  const isPast = new Date(session.starts_at) <= new Date();
                  const nearlyFull =
                    !isPast && spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3;

                  return (
                    <button
                      key={session.id}
                      onClick={() => !isPast && onSelectSession(session)}
                      disabled={isPast}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg border bg-card transition-all group text-left ${
                        isPast
                          ? "border-border opacity-40 cursor-not-allowed"
                          : isFull
                          ? "border-border hover:border-primary/30"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="text-sm font-sans font-medium text-foreground min-w-[70px]">
                        {formatTime(session.starts_at, tz)}
                      </span>
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-sans font-bold flex-shrink-0 ${
                          avatarColors[(offset + i) % avatarColors.length]
                        }`}
                      >
                        {session.practitioner_initials || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-serif text-foreground truncate">
                          {session.class_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {session.location}
                        </p>
                      </div>
                      {isPast && (
                        <span className="text-xs font-sans text-muted-foreground shrink-0">
                          Passed
                        </span>
                      )}
                      {!isPast && isFull && (
                        <span className="text-xs font-sans text-muted-foreground shrink-0">
                          Full · Waitlist →
                        </span>
                      )}
                      {nearlyFull && (
                        <span className="text-xs font-sans text-amber-600 shrink-0">
                          {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
                        </span>
                      )}
                      {!isFull && !isPast && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default SessionFeed;
