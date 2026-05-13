import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { DAY_NAMES, DAY_FULL } from "../hooks/useScheduleRules";
import type { ClassTemplate, Instructor, Location } from "../hooks/useSchedule";

interface CreateRuleValues {
  template_id: string;
  instructor_id: string | null;
  location_id: string | null;
  days: number[];
  start_time: string;
  duration_minutes: number;
  price: number;
  max_capacity: number;
}

export function CreateRuleSheet({
  open,
  onOpenChange,
  templates,
  instructors,
  locations,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: ClassTemplate[];
  instructors: Instructor[];
  locations: Location[];
  onSubmit: (values: CreateRuleValues) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [templateId, setTemplateId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(20);
  const [price, setPrice] = useState(250);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (selectedTemplate) {
      setDuration(selectedTemplate.default_duration_minutes);
      setCapacity(selectedTemplate.default_max_capacity);
      setPrice(Number(selectedTemplate.default_price));
    }
  }, [templateId, selectedTemplate]);

  useEffect(() => {
    if (open) {
      setTemplateId(templates[0]?.id ?? "");
      setInstructorId(instructors[0]?.id ?? "");
      setLocationId(locations[0]?.id ?? "");
      setDays([]);
      setTime("09:00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) { toast.error("Select a class type."); return; }
    if (days.length === 0) { toast.error("Select at least one day."); return; }
    try {
      await onSubmit({
        template_id: templateId,
        instructor_id: instructorId || null,
        location_id: locationId || null,
        days,
        start_time: time,
        duration_minutes: duration,
        price,
        max_capacity: capacity,
      });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create recurring class.");
    }
  };

  const dayLabel = days.length === 0
    ? "No days selected"
    : days.map((d) => DAY_NAMES[d]).join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Add recurring class</SheetTitle>
          <p className="text-sm text-muted-foreground">
            This will appear every week on the selected day(s). Existing bookings are not affected when you change or remove a rule.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field label="Class type *">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="input-base"
              required
            >
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.level ? ` (${t.level})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Days *">
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-md text-sm font-sans transition-colors ${
                    days.includes(d)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {DAY_NAMES[d]}
                </button>
              ))}
            </div>
            {days.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{dayLabel}</p>
            )}
          </Field>

          <Field label="Start time *">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-base"
              required
            />
          </Field>

          <Field label="Instructor">
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="input-base"
            >
              <option value="">— None —</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.display_name}</option>
              ))}
            </select>
          </Field>

          {locations.length > 1 && (
            <Field label="Location">
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="input-base"
              >
                <option value="">— None —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Duration (min)">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={5}
                max={300}
                className="input-base"
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min={1}
                className="input-base"
              />
            </Field>
            <Field label="Price (kr)">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min={0}
                className="input-base"
              />
            </Field>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || days.length === 0}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Adding…" : `Add to timetable${days.length > 1 ? ` (${days.length} days)` : ""}`}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
