import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { DrawerBody } from "../components/DrawerBody";
import { DrawerFooter } from "../components/DrawerFooter";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { toast } from "sonner";
import { useManageDiscountCodes, type DiscountCode } from "@/manage/hooks/useManageDiscountCodes";

const EMPTY: {
  code: string;
  description: string;
  discount_type: "percent" | "fixed_off";
  discount_value: number;
  max_redemptions: string;
  valid_until_select: string;
} = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  max_redemptions: "",
  valid_until_select: "never",
};

type Props =
  | { mode: "create"; code?: never; open: boolean; onClose: () => void }
  | { mode: "edit"; code: DiscountCode | null; open: boolean; onClose: () => void };

export function DiscountCodeDrawer({ mode, code, open, onClose }: Props) {
  const { createCode, updateCode, toggleActive } = useManageDiscountCodes();
  const [draft, setDraft] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && code) {
      setDraft({
        code: code.code,
        description: code.description ?? "",
        discount_type: code.discount_type,
        discount_value: code.discount_value,
        max_redemptions: code.max_redemptions ? String(code.max_redemptions) : "",
        valid_until_select: code.valid_until ? "custom" : "never",
      });
    } else {
      setDraft({ ...EMPTY });
    }
  }, [open, mode, code]);

  const resolveValidUntil = (select: string): string | null => {
    if (select === "never" || select === "custom") return null;
    const d = new Date();
    d.setMonth(d.getMonth() + Number(select));
    return d.toISOString();
  };

  const handleSave = async () => {
    if (mode === "create" && !draft.code.trim()) {
      toast.error("Code is required");
      return;
    }
    try {
      if (mode === "create") {
        await createCode.mutateAsync({
          code: draft.code.trim().toUpperCase(),
          description: draft.description || null,
          discount_type: draft.discount_type,
          discount_value: Number(draft.discount_value),
          max_redemptions: draft.max_redemptions ? Number(draft.max_redemptions) : null,
          currency: null,
          valid_until: resolveValidUntil(draft.valid_until_select),
        });
        toast.success("Discount code created.");
      } else if (code) {
        await updateCode.mutateAsync({
          id: code.id,
          description: draft.description || null,
          discount_type: draft.discount_type,
          discount_value: Number(draft.discount_value),
          max_redemptions: draft.max_redemptions ? Number(draft.max_redemptions) : null,
          valid_until: draft.valid_until_select === "custom" ? code.valid_until : resolveValidUntil(draft.valid_until_select),
        });
        toast.success("Discount code updated.");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save.");
    }
  };

  const handleToggle = async () => {
    if (!code) return;
    try {
      await toggleActive.mutateAsync({ id: code.id, is_active: !code.is_active });
      toast.success(code.is_active ? "Code deactivated." : "Code activated.");
      onClose();
    } catch {
      toast.error("Failed to update.");
    }
  };

  const isPending = createCode.isPending || updateCode.isPending;
  const title = mode === "create" ? "Add discount code" : (code?.description || code?.code || "Edit code");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={undefined}
      actions={
        <DrawerFooter
          isEditing={mode === "edit" && !!code}
          isActive={code?.is_active}
          onDeactivate={handleToggle}
          onCancel={onClose}
          onSave={handleSave}
          loading={isPending}
        />
      }
    >
      <DrawerBody>
        <Field label="Name">
          <input
            style={inputStyle}
            type="text"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Summer promo"
          />
        </Field>
        {mode === "create" && (
          <Field label="Discount code">
            <input
              style={inputStyle}
              type="text"
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
              placeholder="SUMMER20"
            />
          </Field>
        )}
        {mode === "edit" && code && (
          <Field label="Discount code">
            <input
              style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" } as React.CSSProperties}
              type="text"
              value={code.code}
              readOnly
            />
          </Field>
        )}
        <FieldRow>
          <Field label="Type">
            <select
              style={inputStyle as React.CSSProperties}
              value={draft.discount_type}
              onChange={(e) => setDraft((d) => ({ ...d, discount_type: e.target.value as any }))}
            >
              <option value="percent">% off</option>
              <option value="fixed_off">Fixed amount</option>
            </select>
          </Field>
          <Field label={draft.discount_type === "percent" ? "Percent off" : "Amount off"}>
            <input
              style={inputStyle}
              type="number"
              min="1"
              max={draft.discount_type === "percent" ? "99" : undefined}
              value={draft.discount_value}
              onChange={(e) => setDraft((d) => ({ ...d, discount_value: Number(e.target.value) }))}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Max uses">
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={draft.max_redemptions}
              onChange={(e) => setDraft((d) => ({ ...d, max_redemptions: e.target.value }))}
              placeholder="Unlimited"
            />
          </Field>
          <Field label="Expires">
            <select
              style={inputStyle as React.CSSProperties}
              value={draft.valid_until_select}
              onChange={(e) => setDraft((d) => ({ ...d, valid_until_select: e.target.value }))}
            >
              <option value="never">Never</option>
              <option value="1">1 month</option>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">1 year</option>
              {draft.valid_until_select === "custom" && (
                <option value="custom">
                  {code?.valid_until
                    ? new Date(code.valid_until).toLocaleDateString("nb-NO")
                    : "Custom"}
                </option>
              )}
            </select>
          </Field>
        </FieldRow>
      </DrawerBody>
    </Drawer>
  );
}
