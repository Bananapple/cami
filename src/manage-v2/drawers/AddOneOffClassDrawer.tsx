import { useEffect, useMemo, useState } from "react";
import { Drawer } from "../components/Drawer";
import { DrawerBody } from "../components/DrawerBody";
import { DrawerFooter } from "../components/DrawerFooter";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useSchedule, type ClassTemplate } from "@/manage/hooks/useSchedule";
import { toast } from "sonner";

const EMPTY_DRAFT = {
  template_id: "",
  instructor_id: "",
  location_id: "",
  date: "",
  start_time: "09:00",
  duration_minutes: 60,
  max_capacity: 12,
  price: 250,
};

export function AddOneOffClassDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { templates, instructors, locations, createClass } = useSchedule(4);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);

  // Default date = today (in browser local — Studio context usage tolerant)
  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDraft({ ...EMPTY_DRAFT, date: `${yyyy}-${mm}-${dd}` });
  }, [open]);

  // When a template is picked, prefill duration/capacity/price from its defaults
  const selectedTemplate: ClassTemplate | undefined = useMemo(
    () => templates.find((t) => t.id === draft.template_id),
    [templates, draft.template_id]
  );
  useEffect(() => {
    if (!selectedTemplate) return;
    setDraft((d) => ({
      ...d,
      duration_minutes: selectedTemplate.default_duration_minutes,
      max_capacity: selectedTemplate.default_max_capacity,
      price: selectedTemplate.default_price,
    }));
  }, [selectedTemplate]);

  const save = async () => {
    if (!draft.template_id) return toast.error("Pick a class type");
    if (!draft.date) return toast.error("Pick a date");
    if (!draft.start_time) return toast.error("Pick a start time");

    setPending(true);
    try {
      // Compose a local-time ISO that matches the picked date+time
      const startsAt = new Date(`${draft.date}T${draft.start_time}:00`);
      await createClass.mutateAsync({
        template_id: draft.template_id,
        instructor_id: draft.instructor_id || null,
        location_id: draft.location_id || null,
        starts_at: startsAt.toISOString(),
        duration_minutes: Number(draft.duration_minutes),
        max_capacity: Number(draft.max_capacity),
        price: Number(draft.price),
      });
      toast.success("One-off class added");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create class");
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add one-off class"
      subtitle="A single class instance, not tied to the recurring schedule"
      actions={
        <DrawerFooter
          isEditing={false}
          onCancel={onClose}
          onSave={save}
          loading={pending}
          saveLabel="Add class"
        />
      }
    >
      <DrawerBody>
        <Field label="Class type" help="Defaults to template's duration / capacity / price">
          <select
            value={draft.template_id}
            onChange={(e) => setDraft((d) => ({ ...d, template_id: e.target.value }))}
            style={inputStyle as React.CSSProperties}
          >
            <option value="">— Pick a class type —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <FieldRow>
          <Field label="Instructor">
            <select
              value={draft.instructor_id}
              onChange={(e) => setDraft((d) => ({ ...d, instructor_id: e.target.value }))}
              style={inputStyle as React.CSSProperties}
            >
              <option value="">—</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.display_name}
                </option>
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
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
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
      </DrawerBody>
    </Drawer>
  );
}
