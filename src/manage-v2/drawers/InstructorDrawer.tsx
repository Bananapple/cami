import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { DrawerBody } from "../components/DrawerBody";
import { DrawerFooter } from "../components/DrawerFooter";
import { StateBadge } from "../components/Badge";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useManageInstructors, type ManagedInstructor, type InstructorStatus } from "@/manage/hooks/useManageInstructors";
import { useStudioContext } from "@/context/StudioContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "create" | "edit";

const EMPTY_DRAFT = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  initials: "",
  specialty: "",
  bio: "",
  image_url: "",
  status: "active" as InstructorStatus,
  platform_role: "associate" as "manager" | "associate",
  send_invite: true,
};

export function InstructorDrawerV2({
  mode,
  instructor,
  open,
  onClose,
  isOwner = false,
}: {
  mode: Mode;
  instructor?: ManagedInstructor | null;
  open: boolean;
  onClose: () => void;
  isOwner?: boolean;
}) {
  const { create, update, toggleActive } = useManageInstructors();
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && instructor) {
      const storedLast = instructor.last_name ?? "";
      const storedFirst = storedLast
        ? instructor.display_name.replace(new RegExp("\\s+" + storedLast.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "").trim()
        : instructor.display_name.includes(" ")
        ? instructor.display_name.slice(0, instructor.display_name.lastIndexOf(" "))
        : instructor.display_name;
      const fallbackLast = storedLast || (instructor.display_name.includes(" ") ? instructor.display_name.slice(instructor.display_name.lastIndexOf(" ") + 1) : "");
      setDraft({
        first_name: storedFirst,
        last_name: fallbackLast,
        email: instructor.email ?? "",
        phone: instructor.phone ?? "",
        initials: instructor.initials,
        specialty: instructor.specialty ?? "",
        bio: instructor.bio ?? "",
        image_url: instructor.image_url ?? "",
        status: instructor.status,
        platform_role: instructor.platform_role ?? "associate",
        send_invite: false,
      });
    } else {
      setDraft({ ...EMPTY_DRAFT });
    }
  }, [open, mode, instructor]);

  const save = async () => {
    const firstName = draft.first_name.trim();
    const lastName = draft.last_name.trim();
    if (!firstName) {
      toast.error("First name is required");
      return;
    }
    if (!draft.initials.trim()) {
      toast.error("Initials are required (2 characters)");
      return;
    }
    const displayName = lastName ? `${firstName} ${lastName}` : firstName;
    const initials = draft.initials.trim().toUpperCase().slice(0, 2);
    const email = draft.email.trim() || null;
    const phone = draft.phone.trim() || null;

    setPending(true);
    try {
      if (mode === "create") {
        await create.mutateAsync({
          display_name: displayName,
          last_name: lastName || null,
          email,
          phone,
          initials,
          specialty: draft.specialty.trim() || null,
          bio: draft.bio.trim() || null,
          image_url: draft.image_url.trim() || null,
          status: draft.status,
          platform_role: draft.platform_role,
        });

        // Send platform invite if email is set and checkbox is checked
        if (email && draft.send_invite && studioId) {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData?.session;
          const studioRole = draft.platform_role === "manager" ? "manager" : "instructor";
          await supabase.functions.invoke("invite-member", {
            body: {
              email,
              full_name: displayName,
              studio_id: studioId,
              role: studioRole,
            },
            headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
        }

        toast.success("Instructor created");
      } else if (instructor) {
        await update.mutateAsync({
          id: instructor.id,
          display_name: displayName,
          last_name: lastName || null,
          email,
          phone,
          initials,
          specialty: draft.specialty.trim() || null,
          bio: draft.bio.trim() || null,
          image_url: draft.image_url.trim() || null,
          status: draft.status,
          platform_role: draft.platform_role,
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

  const isEditing = mode === "edit" && !!instructor;
  const headerBadge = (() => {
    if (!isEditing) return undefined;
    if (!instructor!.is_active) return <StateBadge tone="neutral">Inactive</StateBadge>;
    if (instructor!.status === "on_leave") return <StateBadge tone="warn">On leave</StateBadge>;
    return <StateBadge tone="good">Active</StateBadge>;
  })();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add instructor" : instructor?.display_name ?? "Edit instructor"}
      subtitle={mode === "create" ? "New instructor for your studio" : "Edit instructor profile"}
      headerMeta={headerBadge}
      actions={
        <DrawerFooter
          isEditing={isEditing}
          isActive={instructor?.is_active}
          onDeactivate={() => {
            toggleActive.mutate(
              { id: instructor!.id, is_active: !instructor!.is_active },
              {
                onSuccess: () => {
                  toast.success(instructor!.is_active ? "Instructor deactivated" : "Instructor activated");
                  onClose();
                },
              }
            );
          }}
          onCancel={onClose}
          onSave={save}
          loading={pending}
          saveLabel={mode === "create" ? "Add instructor" : "Save"}
        />
      }
    >
      <DrawerBody>
        <FieldRow>
          <Field label="First name">
            <input
              type="text"
              value={draft.first_name}
              onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))}
              placeholder="Mira"
              style={inputStyle}
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              value={draft.last_name}
              onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))}
              placeholder="Holm"
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Email">
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              placeholder="mira@example.com"
              style={inputStyle}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="+47 …"
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        <Field label="Initials" help="Used in class avatars (2 chars)">
          <input
            type="text"
            maxLength={2}
            value={draft.initials}
            onChange={(e) =>
              setDraft((d) => ({ ...d, initials: e.target.value.toUpperCase().slice(0, 2) }))
            }
            onFocus={(e) => {
              if (!e.target.value && (draft.first_name || draft.last_name)) {
                const auto = ((draft.first_name[0] ?? "") + (draft.last_name[0] ?? "")).toUpperCase();
                setDraft((d) => ({ ...d, initials: auto }));
              }
            }}
            placeholder="MH"
            style={inputStyle}
          />
        </Field>

        <Field label="Specialty">
          <input
            type="text"
            value={draft.specialty}
            onChange={(e) => setDraft((d) => ({ ...d, specialty: e.target.value }))}
            placeholder="Vinyasa · Mysore"
            style={inputStyle}
          />
        </Field>

        <Field label="Bio" help="Optional — shown on the public teachers page">
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

        <Field
          label="Platform role"
          help={
            isOwner
              ? "Manager sees all tabs. Associate sees Today and Schedule only."
              : "Only the studio owner can change platform roles."
          }
        >
          <select
            value={draft.platform_role}
            onChange={(e) => setDraft((d) => ({ ...d, platform_role: e.target.value as "manager" | "associate" }))}
            disabled={!isOwner}
            style={{ ...(inputStyle as React.CSSProperties), opacity: isOwner ? 1 : 0.6 }}
          >
            <option value="associate">Associate — Today &amp; Schedule only</option>
            <option value="manager">Manager — full access</option>
          </select>
        </Field>

        {/* Show invite checkbox only on create, only when email is filled */}
        {mode === "create" && draft.email.trim() && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--ink-soft)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={draft.send_invite}
              onChange={(e) => setDraft((d) => ({ ...d, send_invite: e.target.checked }))}
              style={{ width: 14, height: 14, accentColor: "var(--action)", cursor: "pointer" }}
            />
            Send platform invite email
          </label>
        )}

        <Field label="Status" help='"On leave" hides them from substitute pickers but keeps history intact'>
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
      </DrawerBody>
    </Drawer>
  );
}
