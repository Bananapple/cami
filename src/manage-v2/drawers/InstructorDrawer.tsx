import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useManageInstructors, type ManagedInstructor, type InstructorStatus } from "@/manage/hooks/useManageInstructors";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useStudioContext } from "@/context/StudioContext";
import { toast } from "sonner";

type Mode = "create" | "edit";

const EMPTY_DRAFT = {
  display_name: "",
  initials: "",
  specialty: "",
  bio: "",
  image_url: "",
  status: "active" as InstructorStatus,
};

export function InstructorDrawerV2({
  mode,
  instructor,
  open,
  onClose,
}: {
  mode: Mode;
  instructor?: ManagedInstructor | null;
  open: boolean;
  onClose: () => void;
}) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();
  const { create, update } = useManageInstructors();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && instructor) {
      setDraft({
        display_name: instructor.display_name,
        initials: instructor.initials,
        specialty: instructor.specialty ?? "",
        bio: instructor.bio ?? "",
        image_url: instructor.image_url ?? "",
        status: instructor.status,
      });
    } else {
      setDraft({ ...EMPTY_DRAFT });
    }
  }, [open, mode, instructor]);

  const save = async () => {
    if (!draft.display_name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!draft.initials.trim()) {
      toast.error("Initials are required (2 characters)");
      return;
    }
    setPending(true);
    try {
      if (mode === "create") {
        await create.mutateAsync({
          display_name: draft.display_name.trim(),
          initials: draft.initials.trim().toUpperCase().slice(0, 2),
          specialty: draft.specialty.trim() || null,
          bio: draft.bio.trim() || null,
          image_url: draft.image_url.trim() || null,
          status: draft.status,
        });
        toast.success("Instructor created");
      } else if (instructor) {
        // status change needs the same update path; the hook's update mutation
        // accepts a partial patch.
        await update.mutateAsync({
          id: instructor.id,
          display_name: draft.display_name.trim(),
          initials: draft.initials.trim().toUpperCase().slice(0, 2),
          specialty: draft.specialty.trim() || null,
          bio: draft.bio.trim() || null,
          image_url: draft.image_url.trim() || null,
          status: draft.status,
        });
        toast.success("Instructor updated");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save instructor");
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add instructor" : instructor?.display_name ?? "Edit instructor"}
      subtitle={mode === "create" ? "New instructor for your studio" : "Edit instructor profile"}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={pending}>
            {mode === "create" ? "Create instructor" : "Save changes"}
          </Button>
        </>
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <FieldRow>
          <Field label="Display name">
            <input
              type="text"
              value={draft.display_name}
              onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
              placeholder="Mira Holm"
              style={inputStyle}
            />
          </Field>
          <Field label="Initials" help="Used in avatars (2 chars)">
            <input
              type="text"
              maxLength={2}
              value={draft.initials}
              onChange={(e) =>
                setDraft((d) => ({ ...d, initials: e.target.value.toUpperCase().slice(0, 2) }))
              }
              placeholder="MH"
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        <Field label="Specialty">
          <input
            type="text"
            value={draft.specialty}
            onChange={(e) => setDraft((d) => ({ ...d, specialty: e.target.value }))}
            placeholder="Vinyasa · Mysore"
            style={inputStyle}
          />
        </Field>

        <Field label="Bio" help="Optional, shown on the public /teachers page">
          <textarea
            rows={3}
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            placeholder="Mira teaches Mysore-style Ashtanga and gentle vinyasa…"
            style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }}
          />
        </Field>

        <Field label="Image URL">
          <input
            type="url"
            value={draft.image_url}
            onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
            placeholder="https://…"
            style={inputStyle}
          />
        </Field>

        <Field label="Status" help='"On leave" hides them from substitute pickers but keeps history visible'>
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as InstructorStatus }))}
            style={inputStyle as React.CSSProperties}
          >
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>
    </Drawer>
  );
}
