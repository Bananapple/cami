import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useManageProducts } from "../hooks/useManageProducts";
import type { Product } from "../hooks/useManageProducts";

type ProductType = "clip_card" | "subscription" | "drop_in" | "private";

interface FormState {
  name: string;
  type: ProductType;
  price: string;
  description: string;
  tag: string;
  image_url: string;
  credits: string;
  validity_days: string;
  billing_interval: "month" | "";
  commitment_months: string;
  requires_contact: boolean;
  display_order: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: "",
  type: "clip_card",
  price: "",
  description: "",
  tag: "",
  image_url: "",
  credits: "",
  validity_days: "",
  billing_interval: "",
  commitment_months: "",
  requires_contact: false,
  display_order: "0",
  is_active: true,
};

function toForm(p: Product): FormState {
  return {
    name: p.name,
    type: p.type as ProductType,
    price: (p.price_minor / 100).toString(),
    description: p.description ?? "",
    tag: p.tag ?? "",
    image_url: p.image_url ?? "",
    credits: p.credits?.toString() ?? "",
    validity_days: p.validity_days?.toString() ?? "",
    billing_interval: (p.billing_interval as "month" | "") ?? "",
    commitment_months: p.commitment_months?.toString() ?? "",
    requires_contact: p.requires_contact,
    display_order: p.display_order.toString(),
    is_active: p.is_active,
  };
}

export function ProductDrawer({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createProduct, updateProduct } = useManageProducts();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(product ? toForm(product) : EMPTY);
  }, [product, open]);

  const set = (key: keyof FormState, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isClipCard = form.type === "clip_card";
  const isSubscription = form.type === "subscription";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        price_minor: Math.round(parseFloat(form.price) * 100),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        tag: form.tag.trim() || null,
        credits: isClipCard && form.credits ? parseInt(form.credits) : null,
        validity_days: isClipCard && form.validity_days ? parseInt(form.validity_days) : null,
        billing_interval: isSubscription && form.billing_interval ? form.billing_interval : null,
        commitment_months: isSubscription && form.commitment_months ? parseInt(form.commitment_months) : null,
        requires_contact: form.requires_contact,
        display_order: parseInt(form.display_order) || 0,
        is_active: form.is_active,
      };

      if (product) {
        await updateProduct.mutateAsync({ id: product.id, ...payload });
        toast.success("Product updated.");
      } else {
        await createProduct.mutateAsync(payload as any);
        toast.success("Product created.");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">
            {product ? "Edit product" : "New product"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Name */}
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. 10-class card"
              className={inputCls}
            />
          </Field>

          {/* Type */}
          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as ProductType)}
              className={inputCls}
            >
              <option value="clip_card">Clip card</option>
              <option value="subscription">Subscription</option>
              <option value="drop_in">Drop-in</option>
              <option value="private">Private / custom</option>
            </select>
          </Field>

          {/* Price */}
          <Field label={isSubscription ? "Price per month (NOK)" : "Price (NOK)"}>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="e.g. 2300"
              className={inputCls}
            />
          </Field>

          {/* Clip card fields */}
          {isClipCard && (
            <>
              <Field label="Number of credits">
                <input
                  type="number"
                  min="1"
                  value={form.credits}
                  onChange={(e) => set("credits", e.target.value)}
                  placeholder="e.g. 10"
                  className={inputCls}
                />
              </Field>
              <Field label="Valid for (days)">
                <input
                  type="number"
                  min="1"
                  value={form.validity_days}
                  onChange={(e) => set("validity_days", e.target.value)}
                  placeholder="e.g. 365"
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {/* Subscription fields */}
          {isSubscription && (
            <Field label="Commitment (months, optional)">
              <input
                type="number"
                min="1"
                value={form.commitment_months}
                onChange={(e) => set("commitment_months", e.target.value)}
                placeholder="e.g. 12 — leave blank for month-to-month"
                className={inputCls}
              />
            </Field>
          )}

          {/* Description */}
          <Field label="Description (optional)">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Shown on the join page"
              className={inputCls + " resize-none"}
            />
          </Field>

          {/* Image URL */}
          <Field label="Image URL (optional)">
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            {form.image_url && (
              <img
                src={form.image_url}
                alt="Preview"
                className="mt-2 w-full aspect-video object-cover rounded-md bg-muted"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </Field>

          {/* Tag */}
          <Field label='Tag (optional, e.g. "Most popular")'>
            <input
              value={form.tag}
              onChange={(e) => set("tag", e.target.value)}
              placeholder="Most popular"
              className={inputCls}
            />
          </Field>

          {/* Display order */}
          <Field label="Display order">
            <input
              type="number"
              min="0"
              value={form.display_order}
              onChange={(e) => set("display_order", e.target.value)}
              className={inputCls}
            />
          </Field>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <Toggle
              label="Requires personal consultation"
              hint="Hides buy button — shows 'contact us' instead"
              checked={form.requires_contact}
              onChange={(v) => set("requires_contact", v)}
            />
            {product && (
              <Toggle
                label="Active"
                hint="Inactive products are hidden from students"
                checked={form.is_active}
                onChange={(v) => set("is_active", v)}
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 py-2.5 border border-border rounded-md text-sm text-foreground/70 hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : product ? "Save changes" : "Create product"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          onClick={() => onChange(!checked)}
          className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${checked ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </div>
      </div>
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary";
