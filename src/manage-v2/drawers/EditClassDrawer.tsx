import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useSchedule, type ScheduleClass } from "@/manage/hooks/useSchedule";
import { toast } from "sonner";

// Edit a single class instance. Template (class type) cannot be changed —
// to convert a class to a different type, cancel + add new. Instructor
// substitution has its own dedicated flow on the parent ClassDrawer.

export function EditClassDrawer({
  cls,
  open,
  onClose,
}: {
  cls: ScheduleClass | null;
  open: boolean;
  onClose: () => void;
}) {
  const { instructors, locations, updateClass } = useSchedule(4);
  const [draft, setDraft] = useState({
    instructor_id: "",
    location_id: "",
    date: "",
    start_time: "",
    duration_minutes: 60,
    max_capacity: 12,
    price: 0,
    notes: "",
  });
  const [pending, setPending] = useState(false);

  // Prefill when opening
  useEffect(() => {
    if (!open || !cls) return;
    const start = new Date(cls.starts_at);
    const end = new Date(cls.ends_at);
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const dd = String(start.getDate()).padStart(2, "0");
    const hh = String(start.getHours()).padStart(2, "0");
    const mi = String(start.getMinutes()).padStart(2, "0");
    setDraft({
      instructor_id: cls.instructor_id ?? "",
      location_id: cls.location_id ?? "",
      date: `${yyyy}-${mm}-${dd}`,
      start_time: `${hh}:${mi}`,
      duration_minutes: Math.round((end.getTime() - start.getTime()) / 60000),
      max_capacity: cls.max_capacity,
      price: cls.price,
      notes: cls.notes ?? "",
    });
  }, [open, cls]);

  if (!cls) return null;

  const save = async () => {
    if (!draft.date) return toast.error("Pick a date");
    if (!draft.start_time) return toast.error("Pick a start time");

    setPending(true);
    try {
      const starts = new Date(`${draft.date}T${draft.start_time}:00`);
      const ends = new Date(starts.getTime() + Number(draft.duration_minutes) * 60_000);
      await updateClass.mutateAsync({
        id: cls.id,
        instructor_id: draft.instructor_id || null,
        location_id: draft.location_id || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        max_capacity: Number(draft.max_capacity),
        price: Number(draft.price),
        notes: draft.notes || null,
      });
      toast.success("Class updated");
      onClose();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === "23P01") {
        toast.error("That instructor or room is already booked at this time.");
      } else {
        toast.error(err?.message ?? "Failed to update class");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit · ${cls.class_name}`}
      subtitle="Changes apply only to this single class instance"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={pending}>Save</Button>
        </>
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <FieldRow>
          <Field label="Instructor">
            <select
              value={draft.instructor_id}
              onChange={(e) => setDraft((d) => ({ ...d, instructor_id: e.target.value }))}
              style={inputStyle as React.CSSProperties}
            >
              <option value="">—</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.display_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select
              value={draft.location_id}
              onChange={(e) => setDraft((d) => ({ ...d, location_id: e.target.value }))}
              style={inputStyle as React.CSSProperties}
            >
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Date">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Start time">
            <input
              type="time"
              value={draft.start_time}
              onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))}
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Duration (min)">
            <input
              type="number"
              min={1}
              value={draft.duration_minutes}
              onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: Number(e.target.value) }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Capacity">
            <input
              type="number"
              min={1}
              value={draft.max_capacity}
              onChange={(e) => setDraft((d) => ({ ...d, max_capacity: Number(e.target.value) }))}
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        <Field label="Drop-in price (kr)">
          <input
            type="number"
            min={0}
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
            style={inputStyle}
          />
        </Field>

        <Field label="Notes" help="Visible to staff in the Today and Schedule screens">
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            rows={3}
            style={{ ...(inputStyle as React.CSSProperties), height: "auto", padding: "8px 10px", resize: "vertical" }}
          />
        </Field>
      </div>
    </Drawer>
  );
}
