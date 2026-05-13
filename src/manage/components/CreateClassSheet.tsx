import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import type { ClassTemplate, Instructor, Location } from "../hooks/useSchedule";

interface CreateClassValues {
  template_id: string;
  instructor_id: string | null;
  location_id: string | null;
  starts_at: string;
  duration_minutes: number;
  max_capacity: number;
  price: number;
}

export function CreateClassSheet({
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
  onSubmit: (values: CreateClassValues) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [templateId, setTemplateId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(20);
  const [price, setPrice] = useState(250);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (selectedTemplate) {
      setDuration(selectedTemplate.default_duration_minutes);
      setCapacity(selectedTemplate.default_max_capacity);
      setPrice(Number(selectedTemplate.default_price) * 100 / 100);
    }
  }, [templateId, selectedTemplate]);

  useEffect(() => {
    if (open) {
      setTemplateId(templates[0]?.id ?? "");
      setInstructorId(instructors[0]?.id ?? "");
      setLocationId(locations[0]?.id ?? "");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().slice(0, 10));
      setTime("09:00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId || !date || !time) {
      toast.error("Please fill in all required fields.");
      return;
    }
    try {
      await onSubmit({
        template_id: templateId,
        instructor_id: instructorId || null,
        location_id: locationId || null,
        starts_at: `${date}T${time}:00`,
        duration_minutes: duration,
        max_capacity: capacity,
        price,
      });
      toast.success("Class added to schedule.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create class.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Add class</SheetTitle>
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
                  {t.name} {t.level ? `(${t.level})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-base"
                required
              />
            </Field>
            <Field label="Time *">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-base"
                required
              />
            </Field>
          </div>

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

          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">
              {selectedTemplate.name} · {duration} min · {capacity} spots · kr {price}
            </p>
          )}

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
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Adding…" : "Add to schedule"}
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
