import { useEffect, useMemo, useState } from "react";
import { Drawer, DrawerSection } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { StateBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { useClassTemplates, type ClassTemplate } from "@/manage/hooks/useClassTemplates";
import { useScheduleRules, type ScheduleRule, DAY_NAMES, DAY_FULL } from "@/manage/hooks/useScheduleRules";
import { useGlobalExceptions, type GlobalException } from "@/manage/hooks/useGlobalExceptions";
import { useManageInstructors } from "@/manage/hooks/useManageInstructors";
import { useManageLocations } from "@/manage/hooks/useManageLocations";
import { useStudioContext } from "@/context/StudioContext";
import { formatDate } from "@/lib/timezone";
import { toast } from "sonner";

export function EditSequenceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { templates, isLoading: tLoading, createTemplate } = useClassTemplates();
  const { rules } = useScheduleRules();
  const { exceptions, add: addException, remove: removeException } = useGlobalExceptions();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  // Single template expanded at a time (collapse others when one opens)
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [addingException, setAddingException] = useState(false);

  // Reset expansion on close
  useEffect(() => {
    if (!open) {
      setExpandedTemplateId(null);
      setCreatingTemplate(false);
      setAddingException(false);
    }
  }, [open]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit sequence"
      subtitle="Class types and recurring schedule"
      actions={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      {/* ── CLASS TYPES ── */}
      <DrawerSection
        title={`Class types · ${templates.length}`}
        action={
          <button
            className="sm-btn sm ghost"
            onClick={() => setCreatingTemplate(true)}
            type="button"
            style={{ marginLeft: "auto" }}
          >
            + Add class type
          </button>
        }
      >
        {tLoading && <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>}

        {!tLoading && templates.length === 0 && !creatingTemplate && (
          <EmptyState
            title="No class types yet"
            hint="Add your first class type to start scheduling."
          />
        )}

        {creatingTemplate && (
          <NewTemplateForm
            onCancel={() => setCreatingTemplate(false)}
            onSaved={(newId) => {
              setCreatingTemplate(false);
              setExpandedTemplateId(newId);
            }}
            create={createTemplate.mutateAsync}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {templates.map((t) => (
            <TemplateBlock
              key={t.id}
              template={t}
              rules={rules.filter((r) => r.template_id === t.id && r.is_active)}
              expanded={expandedTemplateId === t.id}
              onToggle={() => setExpandedTemplateId((id) => (id === t.id ? null : t.id))}
            />
          ))}
        </div>
      </DrawerSection>

      {/* ── GLOBAL EXCEPTIONS ── */}
      <DrawerSection
        title={`Global exceptions · ${exceptions.length}`}
        action={
          <button
            className="sm-btn sm ghost"
            onClick={() => setAddingException(true)}
            type="button"
            style={{ marginLeft: "auto" }}
          >
            + Add exception
          </button>
        }
      >
        {addingException && (
          <NewExceptionForm
            onCancel={() => setAddingException(false)}
            onSaved={() => setAddingException(false)}
            add={addException.mutateAsync}
          />
        )}

        {!addingException && exceptions.length === 0 && (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13, fontStyle: "italic" }}>
            Studio-wide closures (e.g. holidays). When you add a date here, all classes on that day are cancelled.
          </p>
        )}

        {exceptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: addingException ? 12 : 0 }}>
            {exceptions.map((exc) => (
              <ExceptionRow
                key={exc.date}
                exc={exc}
                tz={studioTz}
                onRemove={() => {
                  if (window.confirm(`Restore classes on ${formatDate(exc.date, studioTz, { day: "numeric", month: "short", year: "numeric" })}?`)) {
                    removeException.mutate(exc.date);
                  }
                }}
              />
            ))}
          </div>
        )}
      </DrawerSection>
    </Drawer>
  );
}

// ── Class type block (collapsed row + inline edit form) ────────────
function TemplateBlock({
  template,
  rules,
  expanded,
  onToggle,
}: {
  template: ClassTemplate;
  rules: ScheduleRule[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
              {template.name}
            </span>
            <span className="sm-cat">{template.level ?? "All levels"}</span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
            {template.default_duration_minutes} min · {template.default_max_capacity} spots ·{" "}
            {currency} {template.default_price}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StateBadge tone={template.is_active ? "good" : "neutral"}>
            {template.is_active ? "Active" : "Inactive"}
          </StateBadge>
          <Chevron expanded={expanded} />
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 14px 14px" }}>
          <TemplateEditForm template={template} />
          <div style={{ height: 16 }} />
          <ScheduleGrid templateId={template.id} rules={rules} />
        </div>
      )}
    </div>
  );
}

// ── Template basics edit form (saved on Save changes) ──────────────
function TemplateEditForm({ template }: { template: ClassTemplate }) {
  const { updateTemplate, toggleActive } = useClassTemplates();
  const { instructors } = useManageInstructors();
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";

  const [draft, setDraft] = useState({
    name: template.name,
    description: template.description ?? "",
    level: template.level ?? "all levels",
    default_duration_minutes: template.default_duration_minutes,
    default_max_capacity: template.default_max_capacity,
    default_price: template.default_price,
    default_instructor_id: template.default_instructor_id ?? "",
  });
  const [pending, setPending] = useState(false);

  // Reset when template changes
  useEffect(() => {
    setDraft({
      name: template.name,
      description: template.description ?? "",
      level: template.level ?? "all levels",
      default_duration_minutes: template.default_duration_minutes,
      default_max_capacity: template.default_max_capacity,
      default_price: template.default_price,
      default_instructor_id: template.default_instructor_id ?? "",
    });
  }, [template.id]);

  const save = async () => {
    setPending(true);
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        level: draft.level || null,
        default_duration_minutes: Number(draft.default_duration_minutes),
        default_max_capacity: Number(draft.default_max_capacity),
        default_price: Number(draft.default_price),
        default_instructor_id: draft.default_instructor_id || null,
      });
      toast.success("Class type updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={inputStyle}
        />
      </Field>

      <Field label="Description">
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }}
        />
      </Field>

      <FieldRow>
        <Field label="Level">
          <select
            value={draft.level}
            onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
            style={inputStyle as React.CSSProperties}
          >
            <option value="beginner">Beginner</option>
            <option value="all levels">All levels</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
        <Field label="Default instructor">
          <select
            value={draft.default_instructor_id}
            onChange={(e) => setDraft((d) => ({ ...d, default_instructor_id: e.target.value }))}
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
      </FieldRow>

      <FieldRow>
        <Field label="Duration (min)">
          <input
            type="number"
            min={1}
            value={draft.default_duration_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, default_duration_minutes: Number(e.target.value) }))}
            style={inputStyle}
          />
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            min={1}
            value={draft.default_max_capacity}
            onChange={(e) => setDraft((d) => ({ ...d, default_max_capacity: Number(e.target.value) }))}
            style={inputStyle}
          />
        </Field>
      </FieldRow>

      <Field label={`Drop-in price (${currency})`}>
        <input
          type="number"
          min={0}
          value={draft.default_price}
          onChange={(e) => setDraft((d) => ({ ...d, default_price: Number(e.target.value) }))}
          style={inputStyle}
        />
      </Field>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={() =>
            toggleActive.mutate(
              { id: template.id, is_active: !template.is_active },
              {
                onSuccess: () => toast.success(template.is_active ? "Class type deactivated" : "Class type activated"),
              }
            )
          }
          className="sm-btn sm ghost danger"
          style={{ color: template.is_active ? "var(--bad)" : "var(--good)" }}
        >
          {template.is_active ? "Deactivate type" : "Activate type"}
        </button>
        <Button variant="primary" size="sm" onClick={save} loading={pending}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

// ── Schedule grid (per template) ───────────────────────────────────
function ScheduleGrid({ templateId, rules }: { templateId: string; rules: ScheduleRule[] }) {
  const { addRule, cancelRule } = useScheduleRules();
  const [pickingDay, setPickingDay] = useState(false);

  // Group rules by day_of_week
  const byDay = new Map<number, ScheduleRule[]>();
  for (const r of rules) {
    if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
    byDay.get(r.day_of_week)!.push(r);
  }
  const activeDays = Array.from(byDay.keys()).sort();

  const addDay = (day: number) => {
    setPickingDay(false);
    // Optimistically add a default 09:00 time slot for that day
    addRule.mutate(
      {
        template_id: templateId,
        day_of_week: day,
        start_time: "09:00",
        duration_minutes: 60,
        max_capacity: 12,
        price: 250,
        instructor_id: null,
        location_id: null,
      },
      {
        onSuccess: () => toast.success(`${DAY_FULL[day]} 09:00 added`),
        onError: (e: any) => toast.error(e.message ?? "Failed to add"),
      }
    );
  };

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink-muted)",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Schedule
      </div>

      {activeDays.length === 0 && !pickingDay && (
        <button
          type="button"
          onClick={() => setPickingDay(true)}
          className="sm-btn sm ghost"
        >
          + Add schedule
        </button>
      )}

      {activeDays.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeDays.map((day) => (
            <DayRow
              key={day}
              day={day}
              rules={byDay.get(day)!.sort((a, b) => a.start_time.localeCompare(b.start_time))}
              templateId={templateId}
              onAddTime={(time) =>
                addRule.mutate(
                  {
                    template_id: templateId,
                    day_of_week: day,
                    start_time: time,
                    duration_minutes: byDay.get(day)![0]?.duration_minutes ?? 60,
                    max_capacity: byDay.get(day)![0]?.max_capacity ?? 12,
                    price: byDay.get(day)![0]?.price ?? 250,
                    instructor_id: byDay.get(day)![0]?.instructor_id ?? null,
                    location_id: byDay.get(day)![0]?.location_id ?? null,
                  },
                  {
                    onSuccess: () => toast.success(`${DAY_FULL[day]} ${time} added`),
                    onError: (e: any) => toast.error(e.message ?? "Failed"),
                  }
                )
              }
              onRemoveTime={(ruleId) => cancelRule.mutate(ruleId, { onSuccess: () => toast.success("Time slot removed") })}
            />
          ))}
        </div>
      )}

      {(activeDays.length > 0 || pickingDay) && (
        <div style={{ marginTop: 8 }}>
          {!pickingDay ? (
            <button
              type="button"
              onClick={() => setPickingDay(true)}
              className="sm-btn sm ghost"
            >
              + Add day
            </button>
          ) : (
            <DayPicker
              disabledDays={activeDays}
              onPick={addDay}
              onCancel={() => setPickingDay(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Day picker popover ─────────────────────────────────────────────
function DayPicker({
  disabledDays,
  onPick,
  onCancel,
}: {
  disabledDays: number[];
  onPick: (day: number) => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: 8,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const disabled = disabledDays.includes(d);
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onPick(d)}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: "inherit",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-input)",
              background: "var(--surface)",
              color: disabled ? "var(--ink-faint)" : "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {DAY_FULL[d]}
          </button>
        );
      })}
      <button type="button" onClick={onCancel} className="sm-btn sm ghost" style={{ marginLeft: 4 }}>
        Cancel
      </button>
    </div>
  );
}

// ── Day row (day name + time chips + add time) ─────────────────────
function DayRow({
  day,
  rules,
  templateId: _templateId,
  onAddTime,
  onRemoveTime,
}: {
  day: number;
  rules: ScheduleRule[];
  templateId: string;
  onAddTime: (time: string) => void;
  onRemoveTime: (ruleId: string) => void;
}) {
  const [addingTime, setAddingTime] = useState(false);
  const [newTime, setNewTime] = useState("09:00");

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "8px 10px",
        background: "var(--paper)",
        borderRadius: "var(--r-card)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          width: 80,
          fontSize: 12,
          fontWeight: 500,
          color: "var(--ink-soft)",
          paddingTop: 7,
          flexShrink: 0,
        }}
      >
        <span className="sm-day-mobile" style={{ display: "none" }}>{DAY_NAMES[day]}</span>
        <span className="sm-day-desktop">{DAY_FULL[day]}</span>
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, alignItems: "center" }}>
        {rules.map((r) => (
          <TimeChip key={r.id} time={r.start_time.slice(0, 5)} onCancel={() => onRemoveTime(r.id)} />
        ))}
        {addingTime ? (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              autoFocus
              style={{
                ...inputStyle,
                width: 110,
                height: 28,
                fontSize: 12,
                padding: "0 8px",
              }}
            />
            <button
              type="button"
              onClick={() => {
                onAddTime(newTime);
                setAddingTime(false);
              }}
              className="sm-btn sm primary"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAddingTime(false)}
              className="sm-btn sm ghost"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingTime(true)}
            className="sm-btn sm ghost"
          >
            + Add time
          </button>
        )}
      </div>
    </div>
  );
}

// ── TimeChip with overflow → cancel ────────────────────────────────
function TimeChip({ time, onCancel }: { time: string; onCancel: () => void }) {
  const [showCancel, setShowCancel] = useState(false);

  if (showCancel) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "var(--surface)",
          padding: "0 0 0 10px",
          borderRadius: "var(--r-input)",
          border: "1px solid var(--bad)",
          height: 28,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {time}
        <button
          type="button"
          onClick={onCancel}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--bad)",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 500,
            padding: "0 8px",
            height: "100%",
            cursor: "pointer",
            borderLeft: "1px solid var(--bad)",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setShowCancel(false)}
          aria-label="Dismiss"
          style={{
            border: 0,
            background: "transparent",
            color: "var(--ink-muted)",
            padding: "0 8px 0 4px",
            cursor: "pointer",
            height: "100%",
          }}
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "var(--surface)",
        padding: "0 4px 0 10px",
        borderRadius: "var(--r-input)",
        border: "1px solid var(--line-soft)",
        height: 28,
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: "tabular-nums",
        color: "var(--ink)",
      }}
    >
      {time}
      <button
        type="button"
        onClick={() => setShowCancel(true)}
        aria-label="More"
        style={{
          border: 0,
          background: "transparent",
          color: "var(--ink-muted)",
          padding: "0 4px",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3.5" r="1" />
          <circle cx="8" cy="8" r="1" />
          <circle cx="8" cy="12.5" r="1" />
        </svg>
      </button>
    </span>
  );
}

// ── New template form (Add class type) ─────────────────────────────
function NewTemplateForm({
  onCancel,
  onSaved,
  create,
}: {
  onCancel: () => void;
  onSaved: (id: string) => void;
  create: ReturnType<typeof useClassTemplates>["createTemplate"]["mutateAsync"];
}) {
  const [draft, setDraft] = useState({
    name: "",
    level: "all levels",
    default_duration_minutes: 60,
    default_max_capacity: 12,
    default_price: 250,
  });
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setPending(true);
    try {
      await create({
        name: draft.name.trim(),
        description: null,
        image_url: null,
        level: draft.level,
        default_duration_minutes: draft.default_duration_minutes,
        default_max_capacity: draft.default_max_capacity,
        default_price: draft.default_price,
        default_instructor_id: null,
      } as any);
      toast.success("Class type created");
      // We don't have the new id here without a separate refetch — for MVP just close the form.
      // The new template will appear at the top of the list (sorted by name) once the query invalidates.
      onSaved(""); // closes form; user can click the new row to expand
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        background: "var(--paper)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 8,
      }}
    >
      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Vinyasa Flow"
          autoFocus
          style={inputStyle}
        />
      </Field>
      <FieldRow>
        <Field label="Level">
          <select
            value={draft.level}
            onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
            style={inputStyle as React.CSSProperties}
          >
            <option value="beginner">Beginner</option>
            <option value="all levels">All levels</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
        <Field label="Duration (min)">
          <input
            type="number"
            min={1}
            value={draft.default_duration_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, default_duration_minutes: Number(e.target.value) }))}
            style={inputStyle}
          />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Capacity">
          <input
            type="number"
            min={1}
            value={draft.default_max_capacity}
            onChange={(e) => setDraft((d) => ({ ...d, default_max_capacity: Number(e.target.value) }))}
            style={inputStyle}
          />
        </Field>
        <Field label="Drop-in price">
          <input
            type="number"
            min={0}
            value={draft.default_price}
            onChange={(e) => setDraft((d) => ({ ...d, default_price: Number(e.target.value) }))}
            style={inputStyle}
          />
        </Field>
      </FieldRow>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} loading={pending}>Create class type</Button>
      </div>
    </div>
  );
}

// ── New global exception form ──────────────────────────────────────
function NewExceptionForm({
  onCancel,
  onSaved,
  add,
}: {
  onCancel: () => void;
  onSaved: () => void;
  add: ReturnType<typeof useGlobalExceptions>["add"]["mutateAsync"];
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!date) {
      toast.error("Pick a date");
      return;
    }
    setPending(true);
    try {
      await add({ date, reason: reason.trim() });
      toast.success("Date added — all classes cancelled");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        background: "var(--paper)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <FieldRow>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Reason">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Studio closed"
            style={inputStyle}
          />
        </Field>
      </FieldRow>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} loading={pending}>Add exception</Button>
      </div>
    </div>
  );
}

// ── Exception row ──────────────────────────────────────────────────
function ExceptionRow({
  exc,
  tz,
  onRemove,
}: {
  exc: GlobalException;
  tz: string;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--paper)",
        borderRadius: "var(--r-card)",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 110,
        }}
      >
        {formatDate(exc.date, tz, { weekday: "short", day: "numeric", month: "short" })}
      </span>
      <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
        {exc.reason ?? "All classes cancelled"}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="sm-btn sm ghost danger"
        aria-label="Remove exception"
      >
        Remove
      </button>
    </div>
  );
}

// ── Chevron ────────────────────────────────────────────────────────
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        color: "var(--ink-muted)",
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 80ms",
      }}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}
