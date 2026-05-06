import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer } from "../components/Drawer";
import { DrawerBody } from "../components/DrawerBody";
import { DrawerFooter } from "../components/DrawerFooter";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { Button } from "../components/Button";
import { SectionEyebrow } from "../components/SectionEyebrow";
import { useStudio } from "@/context/StudioContext";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SEGMENT_CONFIG } from "@/manage/hooks/useClientsView";
import type { SegmentConfig } from "@/types/database";

// Edits studios.segment_config (added in 0025). Threshold change applies
// instantly: save → updates DB → calls refreshStudio() → useClientsView
// re-derives lifecycle + frequency labels with the new config.

type Errors = Partial<Record<string, string>>;

export function validate(c: SegmentConfig): Errors {
  const e: Errors = {};
  const lc = c.lifecycle;
  const fq = c.frequency;

  // Lifecycle bounds
  if (lc.newDays < 1) e.newDays = "Must be at least 1 day";
  if (lc.regularDays < 1) e.regularDays = "Must be at least 1 day";
  if (lc.lapsingFromDays < 1) e.lapsingFromDays = "Must be at least 1 day";
  if (lc.lapsingToDays < 1) e.lapsingToDays = "Must be at least 1 day";
  if (lc.lapsingToDays >= lc.lapsingFromDays) {
    e.lapsingToDays = `Must be less than From (${lc.lapsingFromDays})`;
  }
  if (lc.lapsingMinSessions < 1) e.lapsingMinSessions = "Must be at least 1";
  if (lc.inactiveDays < 1) e.inactiveDays = "Must be at least 1 day";
  if (lc.inactiveMinSessions < 1) e.inactiveMinSessions = "Must be at least 1";
  if (lc.oneTimerCooldownDays < 1) e.oneTimerCooldownDays = "Must be at least 1 day";

  // Frequency monotonic
  if (fq.casualMin < 1) e.casualMin = "Must be at least 1";
  if (fq.regularMin <= fq.casualMin) e.regularMin = `Must be more than Casual (${fq.casualMin})`;
  if (fq.devoteeMin <= fq.regularMin) e.devoteeMin = `Must be more than Regular (${fq.regularMin})`;

  return e;
}

export function SegmentConfigDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const studioCtx = useStudio();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SegmentConfig>(
    studioCtx.studio.segment_config ?? DEFAULT_SEGMENT_CONFIG,
  );
  const [saving, setSaving] = useState(false);

  // Re-seed when drawer opens (in case studio config changed since last open).
  useEffect(() => {
    if (open) {
      setDraft(studioCtx.studio.segment_config ?? DEFAULT_SEGMENT_CONFIG);
    }
  }, [open, studioCtx.studio.segment_config]);

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const setLc = <K extends keyof SegmentConfig["lifecycle"]>(
    key: K,
    value: SegmentConfig["lifecycle"][K],
  ) => setDraft((d) => ({ ...d, lifecycle: { ...d.lifecycle, [key]: value } }));

  const setFq = <K extends keyof SegmentConfig["frequency"]>(
    key: K,
    value: SegmentConfig["frequency"][K],
  ) => setDraft((d) => ({ ...d, frequency: { ...d.frequency, [key]: value } }));

  const handleSave = async () => {
    if (hasErrors) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("studios")
        .update({ segment_config: draft })
        .eq("id", studioCtx.studio.id);
      if (error) throw error;
      await studioCtx.refreshStudio();
      // Re-derive segment + tag counts and pill labels for the Clients screen.
      queryClient.invalidateQueries({ queryKey: ["manage", "clients"] });
      toast.success("Segments updated");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setDraft(DEFAULT_SEGMENT_CONFIG);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Configure segments"
      subtitle="Tune the thresholds that classify members into lifecycle stages and frequency tiers. Changes apply immediately on save."
      actions={
        <DrawerFooter
          isEditing
          onCancel={onClose}
          onSave={handleSave}
          loading={saving}
          saveLabel={hasErrors ? "Fix errors to save" : "Save"}
          extraLeft={
            <Button variant="ghost" size="sm" onClick={handleReset} style={{ marginRight: "auto" }}>
              Reset to defaults
            </Button>
          }
        />
      }
    >
      <DrawerBody gap={20}>
        <SectionEyebrow style={{ paddingTop: 4 }}>Lifecycle</SectionEyebrow>

        <FieldRow>
          <Field
            label="New (days)"
            help="A member is New if they joined within this window."
            error={errors.newDays}
          >
            <NumberInput value={draft.lifecycle.newDays} onChange={(v) => setLc("newDays", v)} />
          </Field>
          <Field
            label="Regular (days since last visit)"
            help="A member is Regular if their last booking is within this many days."
            error={errors.regularDays}
          >
            <NumberInput value={draft.lifecycle.regularDays} onChange={(v) => setLc("regularDays", v)} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            label="Lapsing — From (days)"
            help="Lapsing window opens this many days after the last booking."
            error={errors.lapsingFromDays}
          >
            <NumberInput value={draft.lifecycle.lapsingFromDays} onChange={(v) => setLc("lapsingFromDays", v)} />
          </Field>
          <Field
            label="Lapsing — To (days)"
            help="Lapsing window closes this many days after the last booking. Members past this drop into Inactive."
            error={errors.lapsingToDays}
          >
            <NumberInput value={draft.lifecycle.lapsingToDays} onChange={(v) => setLc("lapsingToDays", v)} />
          </Field>
        </FieldRow>

        <Field
          label="Lapsing — minimum sessions"
          help="A member must have at least this many lifetime sessions to be flagged as Lapsing (avoids treating one-timers as lapsed)."
          error={errors.lapsingMinSessions}
        >
          <NumberInput value={draft.lifecycle.lapsingMinSessions} onChange={(v) => setLc("lapsingMinSessions", v)} />
        </Field>

        <FieldRow>
          <Field
            label="Inactive (days since last visit)"
            help="A member is Inactive if they haven't booked in this many days."
            error={errors.inactiveDays}
          >
            <NumberInput value={draft.lifecycle.inactiveDays} onChange={(v) => setLc("inactiveDays", v)} />
          </Field>
          <Field
            label="Inactive — minimum sessions"
            help="A member must have at least this many lifetime sessions to be flagged as Inactive."
            error={errors.inactiveMinSessions}
          >
            <NumberInput value={draft.lifecycle.inactiveMinSessions} onChange={(v) => setLc("inactiveMinSessions", v)} />
          </Field>
        </FieldRow>

        <Field
          label="One-timer cooldown (days)"
          help="A member with one session is treated as a One-timer once their booking is older than this."
          error={errors.oneTimerCooldownDays}
        >
          <NumberInput value={draft.lifecycle.oneTimerCooldownDays} onChange={(v) => setLc("oneTimerCooldownDays", v)} />
        </Field>

        <SectionEyebrow style={{ paddingTop: 4 }}>Frequency (last 30 days)</SectionEyebrow>

        <FieldRow>
          <Field
            label="Casual ≥"
            help="Bookings in last 30 days to qualify as Casual."
            error={errors.casualMin}
          >
            <NumberInput value={draft.frequency.casualMin} onChange={(v) => setFq("casualMin", v)} />
          </Field>
          <Field
            label="Regular ≥"
            help="Bookings in last 30 days to qualify as Regular."
            error={errors.regularMin}
          >
            <NumberInput value={draft.frequency.regularMin} onChange={(v) => setFq("regularMin", v)} />
          </Field>
        </FieldRow>

        <Field
          label="Devotee ≥"
          help="Bookings in last 30 days to qualify as Devotee."
          error={errors.devoteeMin}
        >
          <NumberInput value={draft.frequency.devoteeMin} onChange={(v) => setFq("devoteeMin", v)} />
        </Field>
      </DrawerBody>
    </Drawer>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      style={inputStyle}
    />
  );
}

