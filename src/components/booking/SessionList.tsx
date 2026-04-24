import { ChevronRight, MapPin } from "lucide-react";
import type { ClassInstance } from "@/hooks/useClassInstances";

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
  const filtered = sessions.filter(
    (s) => new Date(s.starts_at).toDateString() === selectedDate.toDateString()
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
          {filtered.map((session, i) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all group text-left"
            >
              <span className="text-sm font-sans font-medium text-foreground min-w-[70px]">
                {session.time}
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

              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionList;
