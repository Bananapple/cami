import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TodayClass } from "../hooks/useTodayClasses";
import { AttendanceList } from "./AttendanceList";
import { useDrawerStack } from "../hooks/useDrawerStack";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime } from "@/lib/timezone";

export function ClassCard({ classInstance }: { classInstance: TodayClass }) {
  const [expanded, setExpanded] = useState(false);
  const { push } = useDrawerStack();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const tz = classInstance.location_timezone ?? studioTz;

  const c = classInstance;
  const utilization = c.max_capacity > 0 ? c.booked_count / c.max_capacity : 0;

  const startsAt = new Date(c.starts_at);
  const endsAt = new Date(c.ends_at);
  const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <button className="text-muted-foreground" aria-label={expanded ? "Collapse" : "Expand"}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="min-w-[60px]">
          <p className="font-mono text-sm">{formatTime(c.starts_at, tz)}</p>
          <p className="text-xs text-muted-foreground">{durationMinutes} min</p>
        </div>
        <div className="flex-1">
          <p className="font-serif text-base">{c.class_name}</p>
          <p className="text-xs text-muted-foreground">
            {c.instructor_name}
            {c.location ? ` · ${c.location}` : ""}
          </p>
        </div>
        <div className="text-right min-w-[70px]">
          <p className="text-sm tabular-nums">
            {c.booked_count}
            <span className="text-muted-foreground"> / {c.max_capacity}</span>
          </p>
          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden ml-auto mt-1">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, utilization * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-background/40">
          <AttendanceList classInstanceId={c.id} />
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                push({ type: "class", id: c.id });
              }}
              className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Class details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
