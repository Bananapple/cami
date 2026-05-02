import { useState } from "react";
import { Plus } from "lucide-react";
import { useSchedule, type ScheduleClass } from "../hooks/useSchedule";
import { useDrawerStack } from "../hooks/useDrawerStack";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime } from "@/lib/timezone";
import { CreateClassSheet } from "../components/CreateClassSheet";

function groupByDay(classes: ScheduleClass[]): Map<string, ScheduleClass[]> {
  const map = new Map<string, ScheduleClass[]>();
  for (const c of classes) {
    const day = c.starts_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(c);
  }
  return map;
}

function dayLabel(isoDate: string, tz: string): string {
  const d = new Date(isoDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  if (diff === 0) return `Today — ${weekday}`;
  if (diff === 1) return `Tomorrow — ${weekday}`;
  return weekday;
}

function StatusDot({ status }: { status: string }) {
  const colours: Record<string, string> = {
    scheduled: "bg-green-500",
    cancelled: "bg-red-400",
    completed: "bg-muted-foreground",
  };
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${colours[status] ?? "bg-muted"}`} />
  );
}

export function ScheduleView() {
  const { classes, isLoading, templates, instructors, locations, createClass } = useSchedule();
  const { push } = useDrawerStack();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const [createOpen, setCreateOpen] = useState(false);

  const grouped = groupByDay(classes);
  const days = Array.from(grouped.keys()).sort();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Next 4 weeks</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add class
        </button>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
              <div className="h-14 bg-muted/40 rounded-lg animate-pulse" />
              <div className="h-14 bg-muted/40 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No classes scheduled in the next 4 weeks.
        </p>
      ) : (
        <div className="space-y-8">
          {days.map((day) => {
            const dayClasses = grouped.get(day)!;
            return (
              <section key={day} className="space-y-2">
                <h2 className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
                  {dayLabel(day, studioTz)}
                </h2>
                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {dayClasses.map((c) => {
                    const tz = c.location_timezone ?? studioTz;
                    const isCancelled = c.status === "cancelled";
                    return (
                      <button
                        key={c.id}
                        onClick={() => push({ type: "class", id: c.id })}
                        className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors text-left ${isCancelled ? "opacity-50" : ""}`}
                      >
                        <StatusDot status={c.status} />
                        <div className="w-14 shrink-0">
                          <p className="font-mono text-sm">{formatTime(c.starts_at, tz)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isCancelled ? "line-through" : ""}`}>
                            {c.class_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.instructor_name}
                            {c.location_name !== "—" ? ` · ${c.location_name}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm tabular-nums">
                            {c.booked_count}
                            <span className="text-muted-foreground"> / {c.max_capacity}</span>
                          </p>
                          {c.booked_count >= c.max_capacity && (
                            <p className="text-xs text-amber-600">Full</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <CreateClassSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        templates={templates}
        instructors={instructors}
        locations={locations}
        onSubmit={async (values) => {
          await createClass.mutateAsync(values);
          setCreateOpen(false);
        }}
        isSubmitting={createClass.isPending}
      />
    </div>
  );
}
