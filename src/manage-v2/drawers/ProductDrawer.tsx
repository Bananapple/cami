import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { DrawerBody } from "../components/DrawerBody";
import { DrawerFooter } from "../components/DrawerFooter";
import { StateBadge } from "../components/Badge";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useManageProducts, type Product } from "@/manage/hooks/useManageProducts";
import { useStudioContext } from "@/context/StudioContext";
import { toast } from "sonner";

type Mode = "create" | "edit";
type ProductType = Product["type"];

const EMPTY_DRAFT: Omit<Product, "id" | "studio_id" | "currency"> = {
  type: "drop_in",
  name: "",
  description: null,
  image_url: null,
  tag: null,
  price_minor: 25000,
  credits: 1,
  validity_days: 30,
  billing_interval: null,
  commitment_months: null,
  requires_contact: false,
  is_active: true,
  display_order: 0,
};

export function ProductDrawerV2({
  mode,
  product,
  open,
  onClose,
}: {
  mode: Mode;
  product?: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";
  const { createProduct, updateProduct, toggleActive } = useManageProducts();
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // Reset draft on open / when switching products
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && product) {
      const { id: _id, studio_id: _sid, currency: _cur, ...rest } = product;
      setDraft(rest);
    } else {
      setDraft({ ...EMPTY_DRAFT });
    }
  }, [open, mode, product]);

  const isPending = createProduct.isPending || updateProduct.isPending;

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (mode === "create") {
        await createProduct.mutateAsync(draft);
        toast.success("Product created");
      } else if (product) {
        await updateProduct.mutateAsync({ id: product.id, ...draft });
        toast.success("Product updated");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save product");
    }
  };

  const isEditing = mode === "edit" && !!product;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add product" : product?.name ?? "Edit product"}
      subtitle={mode === "create" ? "New product for the catalog" : "Edit product details"}
      headerMeta={
        isEditing ? (
          <StateBadge tone={product!.is_active ? "good" : "neutral"}>
            {product!.is_active ? "Active" : "Inactive"}
          </StateBadge>
        ) : undefined
      }
      actions={
        <DrawerFooter
          isEditing={isEditing}
          isActive={product?.is_active}
          onDeactivate={() => {
            toggleActive.mutate(
              { id: product!.id, is_active: !product!.is_active },
              {
                onSuccess: () => {
                  toast.success(product!.is_active ? "Product deactivated" : "Product activated");
                  onClose();
                },
              }
            );
          }}
          onCancel={onClose}
          onSave={save}
          loading={isPending}
          saveLabel={mode === "create" ? "Create product" : "Save"}
        />
      }
    >
      <DrawerBody>
        <Field label="Name">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Drop-in"
            style={inputStyle}
          />
        </Field>

        <Field label="Type">
          <select
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ProductType }))}
            style={inputStyle as React.CSSProperties}
          >
            <option value="drop_in">Drop-in</option>
            <option value="clip_card">Clip card</option>
            <option value="subscription">Subscription</option>
            <option value="private">Private</option>
            <option value="addon">Add-on</option>
          </select>
        </Field>

        <FieldRow>
          <Field label={`Price (${currency})`} help="Stored in minor units (øre/cents)">
            <input
              type="number"
              min={0}
              step={1}
              value={draft.price_minor / 100}
              onChange={(e) => setDraft((d) => ({ ...d, price_minor: Math.round(Number(e.target.value) * 100) }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Credits" help="1 for drop-in; 10 for clip card">
            <input
              type="number"
              min={0}
              value={draft.credits ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, credits: e.target.value ? Number(e.target.value) : null }))
              }
              placeholder="—"
              style={inputStyle}
            />
          </Field>
        </FieldRow>

        {(draft.type === "clip_card" || draft.type === "drop_in") && (
          <Field label="Validity (days)" help="How long the credits stay usable">
            <input
              type="number"
              min={0}
              value={draft.validity_days ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, validity_days: e.target.value ? Number(e.target.value) : null }))
              }
              placeholder="—"
              style={inputStyle}
            />
          </Field>
        )}

        {draft.type === "subscription" && (
          <FieldRow>
            <Field label="Billing interval">
              <select
                value={draft.billing_interval ?? "month"}
                onChange={(e) => setDraft((d) => ({ ...d, billing_interval: e.target.value }))}
                style={inputStyle as React.CSSProperties}
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </Field>
            <Field label="Commitment (months)" help="Optional minimum term">
              <input
                type="number"
                min={0}
                value={draft.commitment_months ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, commitment_months: e.target.value ? Number(e.target.value) : null }))
                }
                placeholder="—"
                style={inputStyle}
              />
            </Field>
          </FieldRow>
        )}

        <Field label="Description">
          <textarea
            rows={3}
            value={draft.description ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
            placeholder="Shown to members on /joinnow"
            style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }}
          />
        </Field>
      </DrawerBody>
    </Drawer>
  );
}
