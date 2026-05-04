import { Fragment, useEffect, useState } from "react";
import { Drawer, DrawerSection } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { StateBadge, CategoryChip } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { RowList } from "../components/Row";
import { useClassTemplates, type ClassTemplate } from "@/manage/hooks/useClassTemplates";
import { useScheduleRules, type ScheduleRule, DAY_FULL } from "@/manage/hooks/useScheduleRules";
import { useGlobalExceptions, type GlobalException } from "@/manage/hooks/useGlobalExceptions";
import { useManageInstructors } from "@/manage/hooks/useManageInstructors";
import { useStudioContext } from "@/context/StudioContext";
import { formatDate } from "@/lib/timezone";
import { toast } from "sonner";

export function EditSequenceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { templates, isLoading: tLoading, createTemplate } = useClassTemplates();
  const { rules } = useScheduleRules();
  const { exceptions, add: addException, remove: removeException } = useGlobalExceptions();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [addingException, setAddingException] = useState(false);

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
        flush
      >
        {tLoading && (
          <p style={{ margin: 0, padding: "12px 16px", color: "var(--ink-muted)", fontSize: 13 }}>
            Loading…
          </p>
        )}

        {!tLoading && templates.length === 0 && !creatingTemplate && (
          <EmptyState title="No class types yet" hint="Add your first class type to start scheduling." />
        )}

        {creatingTemplate && (
          <NewTemplateForm
            onCancel={() => setCreatingTemplate(false)}
            onSaved={() => setCreatingTemplate(false)}
            create={createTemplate.mutateAsync}
          />
        )}

        {templates.length > 0 && (
          <RowList style={{ borderRadius: 0, border: 0, borderTop: creatingTemplate ? "1px solid var(--line-soft)" : 0 }}>
            {templates.map((t) => (
              <Fragment key={t.id}>
                <TemplateRow
                  template={t}
                  expanded={expandedTemplateId === t.id}
                  onToggle={() => setExpandedTemplateId((id) => (id === t.id ? null : t.id))}
                />
                {expandedTemplateId === t.id && (
                  <ExpandedTemplate
                    template={t}
                    rules={rules.filter((r) => r.template_id === t.id && r.is_active)}
                    onClose={() => setExpandedTemplateId(null)}
                  />
                )}
              </Fragment>
            ))}
          </RowList>
        )}
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
        flush
      >
        {addingException && (
          <NewExceptionForm
            onCancel={() => setAddingException(false)}
            onSaved={() => setAddingException(false)}
            add={addException.mutateAsync}
          />
        )}

        {!addingException && exceptions.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "16px",
              color: "var(--ink-muted)",
              fontSize: 13,
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            Studio-wide closures (e.g. holidays). When you add a date here, all classes on that day are cancelled.
          </p>
        )}

        {exceptions.length > 0 && (
          <RowList style={{ borderRadius: 0, border: 0, borderTop: addingException ? "1px solid var(--line-soft)" : 0 }}>
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
          </RowList>
        )}
      </DrawerSection>
    </Drawer>
  );
}

// ── Class type collapsed row ───────────────────────────────────────
function TemplateRow({
  template,
  expanded,
  onToggle,
}: {
  template: ClassTemplate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={"sm-row" + (expanded ? " on" : "")}
      style={{ borderRadius: 0 }}
    >
      <span /> {/* lead slot empty */}
      <div className="body">
        <div className="title">
          <span>{template.name}</span>
          <CategoryChip>{template.level ?? "All levels"}</CategoryChip>
        </div>
        <div className="meta-line">
          {template.default_duration_minutes} min · {template.default_max_capacity} spots ·{" "}
          {currency} {template.default_price}
        </div>
      </div>
      <div className="trail">
        <StateBadge tone={template.is_active ? "good" : "neutral"}>
          {template.is_active ? "Active" : "Inactive"}
        </StateBadge>
      </div>
    </button>
  );
}

// ── Class type expanded edit area ──────────────────────────────────
function ExpandedTemplate({
  template,
  rules,
  onClose,
}: {
  template: ClassTemplate;
  rules: ScheduleRule[];
  onClose: () => void;
}) {
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
      toast.success("Saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        padding: "14px 16px 16px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <TemplateForm
        draft={draft}
        setDraft={setDraft}
        instructors={instructors}
        currency={currency}
      />

      <ScheduleGrid templateId={template.id} rules={rules} />

      {/* Bottom action bar: Deactivate (left) + Cancel + Save (right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            toggleActive.mutate(
              { id: template.id, is_active: !template.is_active },
              {
                onSuccess: () =>
                  toast.success(template.is_active ? "Class type deactivated" : "Class type activated"),
              }
            )
          }
        >
          {template.is_active ? "Deactivate type" : "Activate type"}
        </Button>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} loading={pending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ── Shared template form (used by both Add + Edit) ─────────────────
function TemplateForm({
  draft,
  setDraft,
  instructors,
  currency,
}: {
  draft: any;
  setDraft: (fn: (d: any) => any) => void;
  instructors: { id: string; display_name: string }[];
  currency: string;
}) {
  return (
    <>
      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={inputStyle}
          autoFocus={!draft.name}
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
              <option key={i.id} value={i.id}>{i.display_name}</option>
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
    </>
  );
}

// ── Schedule grid (per template) ───────────────────────────────────
function ScheduleGrid({ templateId, rules }: { templateId: string; rules: ScheduleRule[] }) {
  const { addRule, updateRule, cancelRule } = useScheduleRules();
  const [pickingDay, setPickingDay] = useState(false);

  const byDay = new Map<number, ScheduleRule[]>();
  for (const r of rules) {
    if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
    byDay.get(r.day_of_week)!.push(r);
  }
  const activeDays = Array.from(byDay.keys()).sort();

  const addDay = (day: number) => {
    setPickingDay(false);
    const sample = activeDays.length > 0 ? byDay.get(activeDays[0])![0] : null;
    addRule.mutate(
      {
        template_id: templateId,
        day_of_week: day,
        start_time: "09:00",
        duration_minutes: sample?.duration_minutes ?? 60,
        max_capacity: sample?.max_capacity ?? 12,
        price: sample?.price ?? 250,
        instructor_id: sample?.instructor_id ?? null,
        location_id: sample?.location_id ?? null,
      },
      {
        onSuccess: () => toast.success(`${DAY_FULL[day]} 09:00 added`),
        onError: (e: any) => toast.error(e.message ?? "Failed"),
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
        <button type="button" onClick={() => setPickingDay(true)} className="sm-btn sm ghost">
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
              onAddTime={(time) => {
                const sample = byDay.get(day)![0];
                addRule.mutate(
                  {
                    template_id: templateId,
                    day_of_week: day,
                    start_time: time,
                    duration_minutes: sample.duration_minutes,
                    max_capacity: sample.max_capacity,
                    price: sample.price,
                    instructor_id: sample.instructor_id,
                    location_id: sample.location_id,
                  },
                  {
                    onSuccess: () => toast.success(`${DAY_FULL[day]} ${time} added`),
                    onError: (e: any) => toast.error(e.message ?? "Failed"),
                  }
                );
              }}
              onUpdateTime={(ruleId, newTime) =>
                updateRule.mutate(
                  { id: ruleId, start_time: newTime },
                  { onSuccess: () => toast.success("Time updated") }
                )
              }
              onRemoveTime={(ruleId) =>
                cancelRule.mutate(ruleId, { onSuccess: () => toast.success("Time slot removed") })
              }
            />
          ))}
        </div>
      )}

      {(activeDays.length > 0 || pickingDay) && (
        <div style={{ marginTop: 8 }}>
          {!pickingDay ? (
            <button type="button" onClick={() => setPickingDay(true)} className="sm-btn sm ghost">
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

// ── Day picker ─────────────────────────────────────────────────────
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
        background: "var(--surface)",
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

// ── Day row (day name + time chips + + Add time) ───────────────────
function DayRow({
  day,
  rules,
  onAddTime,
  onUpdateTime,
  onRemoveTime,
}: {
  day: number;
  rules: ScheduleRule[];
  onAddTime: (time: string) => void;
  onUpdateTime: (ruleId: string, newTime: string) => void;
  onRemoveTime: (ruleId: string) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "8px 10px",
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
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
        {DAY_FULL[day]}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, alignItems: "center" }}>
        {rules.map((r) => (
          <TimeChip
            key={r.id}
            initialTime={r.start_time.slice(0, 5)}
            onSave={(t) => onUpdateTime(r.id, t)}
            onDelete={() => onRemoveTime(r.id)}
          />
        ))}
        {adding ? (
          <NewTimeChip
            onSave={(t) => {
              onAddTime(t);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="sm-btn sm ghost">
            + Add time
          </button>
        )}
      </div>
    </div>
  );
}

// ── TimeChip — click time to edit, expands inline ──────────────────
function TimeChip({
  initialTime,
  onSave,
  onDelete,
}: {
  initialTime: string;
  onSave: (newTime: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState(initialTime);

  if (editing) {
    return (
      <span style={chipExpandedStyle}>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          autoFocus
          style={chipInputStyle}
        />
        <CircleButton
          variant="primary"
          aria-label="Save"
          onClick={() => {
            if (time !== initialTime) onSave(time);
            setEditing(false);
          }}
        >
          <PlusIcon />
        </CircleButton>
        <CircleButton
          variant="ghost"
          aria-label="Delete"
          onClick={() => {
            onDelete();
            setEditing(false);
          }}
        >
          <TrashIcon />
        </CircleButton>
        <button
          type="button"
          onClick={() => {
            setTime(initialTime);
            setEditing(false);
          }}
          style={chipCancelButtonStyle}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} style={chipCollapsedStyle}>
      {initialTime}
    </button>
  );
}

// ── NewTimeChip — used for "+ Add time" interaction ────────────────
function NewTimeChip({
  onSave,
  onCancel,
}: {
  onSave: (time: string) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState("09:00");
  return (
    <span style={chipExpandedStyle}>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        autoFocus
        style={chipInputStyle}
      />
      <CircleButton variant="primary" aria-label="Add" onClick={() => onSave(time)}>
        <PlusIcon />
      </CircleButton>
      <button type="button" onClick={onCancel} style={chipCancelButtonStyle}>
        Cancel
      </button>
    </span>
  );
}

// ── Chip styles ────────────────────────────────────────────────────
const chipCollapsedStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "var(--surface)",
  border: "1px solid var(--line-soft)",
  borderRadius: "var(--r-input)",
  height: 28,
  padding: "0 12px",
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: "tabular-nums",
  color: "var(--ink)",
  cursor: "pointer",
};

const chipExpandedStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-input)",
  padding: "4px 6px 4px 6px",
  height: 32,
};

const chipInputStyle: React.CSSProperties = {
  height: 24,
  border: "1px solid var(--line-soft)",
  borderRadius: 4,
  padding: "0 6px",
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: "tabular-nums",
  color: "var(--ink)",
  background: "var(--surface)",
  outline: "none",
  width: 100,
};

const chipCancelButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--ink-soft)",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  padding: "0 6px",
  cursor: "pointer",
};

// ── CircleButton (small filled/ghost circular button for chip actions) ──
function CircleButton({
  children,
  variant = "primary",
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const filled = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: filled ? "1px solid var(--action)" : "1px solid var(--line)",
        background: filled ? "var(--action)" : "var(--surface)",
        color: filled ? "var(--action-on)" : "var(--ink-muted)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" />
    </svg>
  );
}

// ── New template form (Add class type — full fields) ──────────────
function NewTemplateForm({
  onCancel,
  onSaved,
  create,
}: {
  onCancel: () => void;
  onSaved: () => void;
  create: ReturnType<typeof useClassTemplates>["createTemplate"]["mutateAsync"];
}) {
  const { instructors } = useManageInstructors();
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    level: "all levels",
    default_duration_minutes: 60,
    default_max_capacity: 12,
    default_price: 250,
    default_instructor_id: "",
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
        description: draft.description.trim() || null,
        image_url: null,
        level: draft.level,
        default_duration_minutes: draft.default_duration_minutes,
        default_max_capacity: draft.default_max_capacity,
        default_price: draft.default_price,
        default_instructor_id: draft.default_instructor_id || null,
      } as any);
      toast.success("Class type created — add a schedule by expanding the new row");
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
        background: "var(--paper)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <TemplateForm
        draft={draft}
        setDraft={setDraft}
        instructors={instructors}
        currency={currency}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} loading={pending}>
          Create class type
        </Button>
      </div>
    </div>
  );
}

// ── Global exception form ──────────────────────────────────────────
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
        background: "var(--paper)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderBottom: "1px solid var(--line-soft)",
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

// ── Exception row (flush, hairline-separated) ─────────────────────
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
      className="sm-row"
      style={{ borderRadius: 0, cursor: "default" }}
    >
      <span
        className="lead time"
        style={{
          minWidth: 110,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatDate(exc.date, tz, { weekday: "short", day: "numeric", month: "short" })}
      </span>
      <div className="body">
        <div className="title">
          <span style={{ fontWeight: 400 }}>{exc.reason ?? "All classes cancelled"}</span>
        </div>
      </div>
      <div className="trail">
        <Button variant="danger" size="sm" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
}
