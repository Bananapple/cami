import type { ReactNode } from "react";
import { Button } from "./Button";

export function DrawerFooter({
  isEditing,
  isActive,
  onDeactivate,
  onCancel,
  onSave,
  saveLabel,
  loading,
  destructiveLabel,
  extraLeft,
}: {
  isEditing: boolean;
  isActive?: boolean;
  onDeactivate?: () => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  loading?: boolean;
  destructiveLabel?: string;
  extraLeft?: ReactNode;
}) {
  return (
    <>
      {isEditing && onDeactivate && (
        <Button
          variant="danger"
          size="sm"
          onClick={onDeactivate}
          style={{ marginRight: "auto" }}
        >
          {destructiveLabel ?? (isActive ? "Deactivate" : "Activate")}
        </Button>
      )}
      {extraLeft}
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onSave} loading={loading}>
        {saveLabel ?? (isEditing ? "Save" : "Create")}
      </Button>
    </>
  );
}
