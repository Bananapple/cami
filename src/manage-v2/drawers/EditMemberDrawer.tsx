import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useUpdateMember } from "@/manage/hooks/useUpdateMember";
import type { ManagerMember } from "@/manage/hooks/useMember";

export function EditMemberDrawer({
  member,
  open,
  onClose,
}: {
  member: ManagerMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateMember();
  const [draft, setDraft] = useState({
    full_name: "",
    phone_number: "",
    level: "all levels",
  });

  useEffect(() => {
    if (!open || !member) return;
    setDraft({
      full_name: member.full_name ?? "",
      phone_number: member.phone_number ?? "",
      level: member.level ?? "all levels",
    });
  }, [open, member]);

  if (!member) return null;

  const save = async () => {
    if (!draft.full_name.trim()) return toast.error("Name is required");
    try {
      await update.mutateAsync({
        user_id: member.user_id,
        full_name: draft.full_name.trim(),
        phone_number: draft.phone_number.trim() || null,
        level: draft.level || null,
      });
      toast.success("Member updated");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update member");
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit · ${member.full_name}`}
      subtitle="Email isn't editable — it's the member's sign-in identity."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={update.isPending}>Save</Button>
        </>
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <FieldRow>
          <Field label="Full name">
            <input
              type="text"
              value={draft.full_name}
              onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={draft.phone_number}
              onChange={(e) => setDraft((d) => ({ ...d, phone_number: e.target.value }))}
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        <Field label="Email" help="Read-only — managed by sign-in">
          <input
            type="email"
            value={member.email ?? ""}
            disabled
            style={{ ...inputStyle, background: "var(--surface-2)", color: "var(--ink-muted)" }}
          />
        </Field>

        <Field label="Level" help="Optional starting level (member can update later)">
          <select
            value={draft.level}
            onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
            style={inputStyle as React.CSSProperties}
          >
            <option value="all levels">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
      </div>
    </Drawer>
  );
}
