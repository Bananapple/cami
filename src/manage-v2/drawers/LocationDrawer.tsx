import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { Button } from "../components/Button";
import { StateBadge } from "../components/Badge";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useManageLocations, type ManagedLocation } from "@/manage/hooks/useManageLocations";
import { toast } from "sonner";

type Mode = "create" | "edit";

const EMPTY_DRAFT = {
  name: "",
  address: "",
  timezone: "",
  default_capacity: 20,
};

export function LocationDrawerV2({
  mode,
  location,
  open,
  onClose,
}: {
  mode: Mode;
  location?: ManagedLocation | null;
  open: boolean;
  onClose: () => void;
}) {
  const { create, update, toggleActive } = useManageLocations();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && location) {
      setDraft({
        name: location.name,
        address: location.address ?? "",
        timezone: location.timezone ?? "",
        default_capacity: location.default_capacity,
      });
    } else {
      setDraft({ ...EMPTY_DRAFT });
    }
  }, [open, mode, location]);

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setPending(true);
    try {
      if (mode === "create") {
        await create.mutateAsync({
          name: draft.name.trim(),
          address: draft.address.trim() || null,
          timezone: draft.timezone.trim() || null,
          default_capacity: Number(draft.default_capacity) || 0,
        });
        toast.success("Location created");
      } else if (location) {
        await update.mutateAsync({
          id: location.id,
          name: draft.name.trim(),
          address: draft.address.trim() || null,
          timezone: draft.timezone.trim() || null,
          default_capacity: Number(draft.default_capacity) || 0,
        });
        toast.success("Location updated");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save location");
    } finally {
      setPending(false);
    }
  };

  const isEditing = mode === "edit" && !!location;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add location" : location?.name ?? "Edit location"}
      subtitle={mode === "create" ? "New room or branch" : "Edit location details"}
      headerMeta={
        isEditing ? (
          <StateBadge tone={location!.is_active ? "good" : "neutral"}>
            {location!.is_active ? "Active" : "Inactive"}
          </StateBadge>
        ) : undefined
      }
      actions={
        <>
          {isEditing && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                toggleActive.mutate(
                  { id: location!.id, is_active: !location!.is_active },
                  {
                    onSuccess: () => {
                      toast.success(location!.is_active ? "Location deactivated" : "Location activated");
                      onClose();
                    },
                  }
                );
              }}
              style={{ marginRight: "auto" }}
            >
              {location!.is_active ? "Deactivate" : "Activate"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={pending}>
            {mode === "create" ? "Create location" : "Save"}
          </Button>
        </>
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Name">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Studio"
            style={inputStyle}
          />
        </Field>

        <Field label="Address">
          <input
            type="text"
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            placeholder="Storgata 1, 0182 Oslo"
            style={inputStyle}
          />
        </Field>

        <FieldRow>
          <Field label="Default capacity">
            <input
              type="number"
              min={1}
              value={draft.default_capacity}
              onChange={(e) => setDraft((d) => ({ ...d, default_capacity: Number(e.target.value) }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Timezone" help="IANA name, e.g. Europe/Oslo">
            <input
              type="text"
              value={draft.timezone}
              onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
              placeholder="Europe/Oslo"
              style={inputStyle}
            />
          </Field>
        </FieldRow>
      </div>
    </Drawer>
  );
}
