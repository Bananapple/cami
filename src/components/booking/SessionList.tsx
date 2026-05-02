import { ChevronRight, MapPin } from "lucide-react";
import type { ClassInstance } from "@/hooks/useClassInstances";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime, toDateString } from "@/lib/timezone";

interface SessionListProps {
  sessions: ClassInstance[];
  selectedDate: Date;
  onSelectSession: (session: ClassInstance) => void;
}

const avatarColors = [
  "bg-primary/20 text-primary",
  "bg-accent/20 text-accent",
  "bg-terracotta-500/20 text-terracotta-700",
  "bg-warm-olive/20 text-warm-olive",
  "bg-secondary text-secondary-foreground",
];

const SessionList = ({ sessions, selectedDate, onSelectSession }: SessionListProps) => {
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  // Compare dates in studio timezone so a class at 07:30 Oslo
  // appears on April 25 even when the viewer is in a different timezone.
  const selectedDateStr = toDateString(selectedDate, studioTz);
  const filtered = sessions.filter(
    (s) => toDateString(s.starts_at, studioTz) === selectedDateStr
  );

  const dateLabel = selectedDate.toLocaleDateString("nb-NO", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-3">
      <p className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
        Sessions for {dateLabel}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground font-serif py-8 text-center">
          No sessions available for this date.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((session, i) => {
            const tz = session.location_timezone ?? studioTz;
            const spotsLeft = session.max_capacity > 0
              ? session.max_capacity - session.booked_count
              : null;
            const isFull = spotsLeft !== null && spotsLeft <= 0;
            const isPast = new Date(session.starts_at) <= new Date();
            const isDisabled = isPast;
            const nearlyFull = !isPast && spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3;

            return (
              <button
                key={session.id}
                onClick={() => !isDisabled && onSelectSession(session)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border bg-card transition-all group text-left ${
                  isDisabled
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
                    avatarColors[i % avatarColors.length]
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
                  <span className="text-xs font-sans text-muted-foreground shrink-0">Passed</span>
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
                {!isFull && !isDisabled && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SessionList;
