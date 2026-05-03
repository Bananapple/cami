import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClassTemplates } from "../hooks/useClassTemplates";
import type { ClassTemplate } from "../hooks/useClassTemplates";
import { useScheduleRules } from "../hooks/useScheduleRules";
import { useStudioContext } from "@/context/StudioContext";

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 21; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}
TIME_OPTIONS.push("22:00");

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function makeId() { return Math.random().toString(36).slice(2, 9); }

type DayEntry = { id: string; day: number | null; times: string[] };

export function EditSequenceSheet({
  open,
  onOpenChange,
  instructors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructors: { id: string; display_name: string }[];
}) {
  const { templates, isLoading, toggleActive } = useClassTemplates();
  const { rules } = useScheduleRules();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const templateRules = (id: string) =>
    rules.filter((r) => r.template_id === id && r.is_active);

  const handleEdit = (id: string) =>
    setEditingId((prev) => (prev === id ? null : id));

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setEditingId(null); onOpenChange(o); }}>
      <SheetContent side="right" className="w-[580px] sm:max-w-[580px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Edit sequence</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
                Class types
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Includes recurring schedule. Changes don't affect existing bookings.
              </p>
            </div>
            <button
              onClick={() => setEditingId("new")}
              disabled={editingId === "new"}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add class type
            </button>
          </div>

          {isLoading && (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          )}

          {editingId === "new" && (
            <TemplateEditForm
              template={null}
              existingRules={[]}
              instructors={instructors}
              onDone={() => setEditingId(null)}
            />
          )}

          {templates.map((tmpl) =>
            editingId === tmpl.id ? (
              <TemplateEditForm
                key={tmpl.id}
                template={tmpl}
                existingRules={templateRules(tmpl.id)}
                instructors={instructors}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                onEdit={() => handleEdit(tmpl.id)}
                onToggle={() =>
                  toggleActive.mutate(
                    { id: tmpl.id, is_active: !tmpl.is_active },
                    { onError: () => toast.error("Failed to update.") }
                  )
                }
              />
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TemplateCard({
  template,
  onEdit,
  onToggle,
}: {
  template: ClassTemplate;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const meta = [
    template.level ?? "All levels",
    `${template.default_duration_minutes} min`,
    `${template.default_max_capacity} spots`,
    `kr ${template.default_price}`,
  ].join(" · ");

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${
        template.is_active ? "" : "opacity-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-serif">{template.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
      <button
        onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${
          template.is_active
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {template.is_active ? "Active" : "Inactive"}
      </button>
      <button
        onClick={onEdit}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TemplateEditForm({
  template,
  existingRules,
  instructors,
  onDone,
}: {
  template: ClassTemplate | null;
  existingRules: ReturnType<typeof useScheduleRules>["rules"];
  instructors: { id: string; display_name: string }[];
  onDone: () => void;
}) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id ?? "";
  const qc = useQueryClient();
  const { deactivateRule } = useScheduleRules();

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState<string | null>(template?.description ?? null);
  const [level, setLevel] = useState<string | null>(template?.level ?? null);
  const [duration, setDuration] = useState(template?.default_duration_minutes ?? 60);
  const [price, setPrice] = useState(template?.default_price ?? 0);
  const [capacity, setCapacity] = useState(template?.default_max_capacity ?? 20);
  const [instructorId, setInstructorId] = useState<string | null>(
    (template as any)?.default_instructor_id ?? existingRules[0]?.instructor_id ?? null
  );

  const [schedule, setSchedule] = useState<DayEntry[]>(() => {
    const byDay = new Map<number, string[]>();
    for (const r of existingRules) {
      if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
      byDay.get(r.day_of_week)!.push(r.start_time.slice(0, 5));
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, times]) => ({ id: makeId(), day, times: times.sort() }));
  });

  const [isSaving, setIsSaving] = useState(false);

  const usedDays = new Set(schedule.filter((d) => d.day !== null).map((d) => d.day as number));
  const hasPendingDay = schedule.some((d) => d.day === null);

  const addDay = () =>
    setSchedule((prev) => [...prev, { id: makeId(), day: null, times: [] }]);

  const selectDay = (entryId: string, day: number) =>
    setSchedule((prev) => prev.map((d) => (d.id === entryId ? { ...d, day } : d)));

  const addTime = (entryId: string, time: string) =>
    setSchedule((prev) =>
      prev.map((d) =>
        d.id === entryId ? { ...d, times: [...d.times, time].sort() } : d
      )
    );

  const removeTime = (entryId: string, timeIdx: number) =>
    setSchedule((prev) => {
      const next = prev.map((d) => {
        if (d.id !== entryId) return d;
        return { ...d, times: d.times.filter((_, i) => i !== timeIdx) };
      });
      return next.filter((d) => d.day === null || d.times.length > 0);
    });

  const removeDay = (entryId: string) =>
    setSchedule((prev) => prev.filter((d) => d.id !== entryId));

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setIsSaving(true);
    try {
      const isNew = !template?.id;
      let templateId = template?.id;

      if (isNew) {
        const { data, error } = await supabase
          .from("class_templates")
          .insert({
            studio_id: studioId,
            name: name.trim(),
            description: description || null,
            level: level || null,
            default_instructor_id: instructorId || null,
            default_duration_minutes: duration,
            default_price: price,
            default_max_capacity: capacity,
            is_active: true,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        templateId = data.id;
      } else {
        const { error } = await supabase
          .from("class_templates")
          .update({
            name: name.trim(),
            description: description || null,
            level: level || null,
            default_instructor_id: instructorId || null,
            default_duration_minutes: duration,
            default_price: price,
            default_max_capacity: capacity,
          } as any)
          .eq("id", templateId!);
        if (error) throw error;

        // Apply instructor change to all active rules for this template
        await supabase
          .from("schedule_rules")
          .update({ instructor_id: instructorId || null })
          .eq("template_id", templateId!)
          .eq("is_active", true);
      }

      // Schedule diff
      const origMap = new Map(
        existingRules.map((r) => [
          `${r.day_of_week}:${r.start_time.slice(0, 5)}`,
          r.id,
        ])
      );
      const newKeys = new Set(
        schedule.flatMap((d) =>
          d.day === null ? [] : d.times.map((t) => `${d.day}:${t}`)
        )
      );

      // Deactivate removed rules
      for (const r of existingRules) {
        const key = `${r.day_of_week}:${r.start_time.slice(0, 5)}`;
        if (!newKeys.has(key)) {
          await deactivateRule.mutateAsync(r.id);
        }
      }

      // Create new rules
      const today = new Date().toISOString().slice(0, 10);
      const toCreate = schedule.flatMap((d) => {
        if (d.day === null) return [];
        return d.times
          .filter((t) => !origMap.has(`${d.day}:${t}`))
          .map((t) => ({
            studio_id: studioId,
            template_id: templateId!,
            instructor_id: instructorId || null,
            location_id: null,
            day_of_week: d.day!,
            start_time: t + ":00",
            duration_minutes: duration,
            price,
            max_capacity: capacity,
            effective_from: today,
            is_active: true,
          }));
      });

      if (toCreate.length > 0) {
        const { error } = await supabase.from("schedule_rules").insert(toCreate as any);
        if (error) throw error;
        await supabase.rpc("materialize_class_instances" as any);
      }

      qc.invalidateQueries({ queryKey: ["manage", "class_templates"] });
      qc.invalidateQueries({ queryKey: ["manage", "schedule_rules"] });
      qc.invalidateQueries({ queryKey: ["manage", "schedule"] });

      toast.success(isNew ? "Class type created." : "Class type updated.");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/40 p-4 space-y-4 bg-muted/20">
      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-sans text-muted-foreground">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ashtanga Mysore"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-sans text-muted-foreground">Description</label>
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value || null)}
          rows={2}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none"
        />
      </div>

      {/* Level | Duration */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Level</label>
          <select
            value={level ?? ""}
            onChange={(e) => setLevel(e.target.value || null)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          >
            <option value="">— Any level —</option>
            <option value="beginner">Beginner</option>
            <option value="all levels">All levels</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Duration (min)</label>
          <input
            type="number"
            min="5"
            max="300"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
      </div>

      {/* Price | Capacity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Default price (kr)</label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Default capacity</label>
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
      </div>

      {/* Default teacher */}
      <div className="space-y-1">
        <label className="text-xs font-sans text-muted-foreground">Default teacher</label>
        <select
          value={instructorId ?? ""}
          onChange={(e) => setInstructorId(e.target.value || null)}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
        >
          <option value="">— None —</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>{i.display_name}</option>
          ))}
        </select>
      </div>

      {/* Schedule builder */}
      <div className="space-y-2 pt-1">
        <label className="text-xs font-sans text-muted-foreground">Schedule</label>
        <div className="space-y-2">
          {schedule.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center gap-2">
              {entry.day === null ? (
                <select
                  autoFocus
                  value=""
                  onChange={(e) => e.target.value !== "" && selectDay(entry.id, Number(e.target.value))}
                  className="border border-border rounded-full px-3 py-1 text-sm bg-background"
                >
                  <option value="">Pick day…</option>
                  {[1, 2, 3, 4, 5, 6, 0].filter((d) => !usedDays.has(d)).map((d) => (
                    <option key={d} value={d}>{DAY_FULL[d]}</option>
                  ))}
                </select>
              ) : (
                <>
                  <span className="border border-border rounded-full px-3 py-1 text-sm font-medium shrink-0">
                    {DAY_SHORT[entry.day]}
                  </span>
                  {entry.times.map((t, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 border border-border rounded-full px-2.5 py-1 text-sm bg-muted/40"
                    >
                      {t}
                      <button
                        onClick={() => removeTime(entry.id, i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {TIME_OPTIONS.filter((t) => !entry.times.includes(t)).length > 0 && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && addTime(entry.id, e.target.value)}
                      className="border border-dashed border-border rounded-full px-3 py-1 text-sm text-muted-foreground bg-background hover:border-foreground transition-colors"
                    >
                      <option value="">+ time</option>
                      {TIME_OPTIONS.filter((t) => !entry.times.includes(t)).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => removeDay(entry.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0"
                    title="Remove this day"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {!hasPendingDay && usedDays.size < 7 && (
            <button
              onClick={addDay}
              className="border border-dashed border-border rounded-full px-3 py-1 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              + Add day
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onDone}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
