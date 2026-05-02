import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSchedule, type ScheduleClass } from "../hooks/useSchedule";
import { useScheduleRules, DAY_NAMES, DAY_FULL } from "../hooks/useScheduleRules";
import { useDrawerStack } from "../hooks/useDrawerStack";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime } from "@/lib/timezone";
import { CreateClassSheet } from "../components/CreateClassSheet";
import { CreateRuleSheet } from "../components/CreateRuleSheet";
import { toast } from "sonner";

type Tab = "upcoming" | "timetable";

function groupByDay(classes: ScheduleClass[]): Map<string, ScheduleClass[]> {
  const map = new Map<string, ScheduleClass[]>();
  for (const c of classes) {
    const day = c.starts_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(c);
  }
  return map;
}

function dayLabel(isoDate: string): string {
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
  const { classes, isLoading: classesLoading, templates, instructors, locations, createClass } = useSchedule();
  const { rules, isLoading: rulesLoading, createRules, deactivateRule } = useScheduleRules();
  const { push } = useDrawerStack();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const [tab, setTab] = useState<Tab>("upcoming");
  const [createOpen, setCreateOpen] = useState(false);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);

  const grouped = groupByDay(classes);
  const days = Array.from(grouped.keys()).sort();

  // Group rules by day of week
  const rulesByDay = new Map<number, typeof rules>();
  for (const r of rules.filter((r) => r.is_active)) {
    if (!rulesByDay.has(r.day_of_week)) rulesByDay.set(r.day_of_week, []);
    rulesByDay.get(r.day_of_week)!.push(r);
  }
  const activeDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => rulesByDay.has(d));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Schedule</h1>
        </div>
        <button
          onClick={() => tab === "upcoming" ? setCreateOpen(true) : setCreateRuleOpen(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {tab === "upcoming" ? "Add one-off class" : "Add recurring class"}
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["upcoming", "timetable"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "upcoming" ? "Upcoming (4 weeks)" : "Timetable"}
          </button>
        ))}
      </div>

      {/* Upcoming tab */}
      {tab === "upcoming" && (
        classesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
                <div className="h-14 bg-muted/40 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No classes scheduled in the next 4 weeks.</p>
        ) : (
          <div className="space-y-8">
            {days.map((day) => {
              const dayClasses = grouped.get(day)!;
              return (
                <section key={day} className="space-y-2">
                  <h2 className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
                    {dayLabel(day)}
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
                            <p className={`text-sm font-medium ${isCancelled ? "line-through" : ""}`}>{c.class_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.instructor_name}
                              {c.location_name !== "—" ? ` · ${c.location_name}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm tabular-nums">
                              {c.booked_count}<span className="text-muted-foreground"> / {c.max_capacity}</span>
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
        )
      )}

      {/* Timetable tab */}
      {tab === "timetable" && (
        rulesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activeDays.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-muted-foreground">No recurring classes set up yet.</p>
            <button onClick={() => setCreateRuleOpen(true)} className="text-sm text-primary hover:underline">
              Add your first recurring class →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeDays.map((dow) => (
              <section key={dow} className="space-y-2">
                <h2 className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
                  {DAY_FULL[dow]}
                </h2>
                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {rulesByDay.get(dow)!.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-14 shrink-0">
                        <p className="font-mono text-sm">{rule.start_time.slice(0, 5)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{rule.class_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rule.instructor_name ?? "No instructor"}
                          {" · "}{rule.duration_minutes} min
                          {" · "}{rule.max_capacity} spots
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove ${rule.class_name} from ${DAY_FULL[rule.day_of_week]}s?`)) return;
                          try {
                            await deactivateRule.mutateAsync(rule.id);
                            toast.success("Recurring class removed. Existing bookings are unaffected.");
                          } catch {
                            toast.error("Failed to remove rule.");
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Remove from timetable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
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

      <CreateRuleSheet
        open={createRuleOpen}
        onOpenChange={setCreateRuleOpen}
        templates={templates}
        instructors={instructors}
        locations={locations}
        onSubmit={async (values) => {
          await createRules.mutateAsync(values);
          setCreateRuleOpen(false);
          toast.success("Recurring class added. Schedule updated.");
        }}
        isSubmitting={createRules.isPending}
      />
    </div>
  );
}
