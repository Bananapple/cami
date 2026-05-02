import { useState } from "react";
import { Plus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useManageProducts } from "../hooks/useManageProducts";
import type { Product } from "../hooks/useManageProducts";
import { ProductDrawer } from "../drawers/ProductDrawer";
import { useManageDiscountCodes } from "../hooks/useManageDiscountCodes";
import type { DiscountCode } from "../hooks/useManageDiscountCodes";
import { useManageStudio } from "../hooks/useManageStudio";

const TYPE_LABEL: Record<string, string> = {
  clip_card: "Clip card",
  subscription: "Subscription",
  drop_in: "Drop-in",
  private: "Private",
};

const EMPTY_CODE = {
  code: "",
  description: "",
  discount_type: "percent" as const,
  discount_value: 10,
  currency: null as string | null,
  valid_until: null as string | null,
  max_redemptions: null as number | null,
};

export function StudioView() {
  const { data: products = [], isLoading, error, toggleActive } = useManageProducts();
  const [drawerProduct, setDrawerProduct] = useState<Product | null | "new">(null);

  const {
    data: discountCodes = [],
    isLoading: codesLoading,
    error: codesError,
    createCode,
    toggleActive: toggleCode,
  } = useManageDiscountCodes();

  const { studio, save: saveStudio } = useManageStudio();
  const [referralEnabled, setReferralEnabled] = useState<boolean | null>(null);
  const [referralPct, setReferralPct] = useState<number | null>(null);

  // Sync local state from studio once loaded
  const studioReferralEnabled = (studio as any)?.referral_enabled ?? false;
  const studioReferralPct = (studio as any)?.referral_discount_percent ?? 20;

  const [addCodeOpen, setAddCodeOpen] = useState(false);
  const [newCode, setNewCode] = useState({ ...EMPTY_CODE });

  const handleCreateCode = async () => {
    if (!newCode.code.trim()) { toast.error("Code is required."); return; }
    try {
      await createCode.mutateAsync({
        ...newCode,
        code: newCode.code.trim().toUpperCase(),
        description: newCode.description || null,
        discount_value: Number(newCode.discount_value),
        max_redemptions: newCode.max_redemptions ? Number(newCode.max_redemptions) : null,
      });
      setNewCode({ ...EMPTY_CODE });
      setAddCodeOpen(false);
      toast.success("Discount code created.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create code.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
      {/* Products section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif">Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your products and studio settings.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
            Products
          </h2>
          <button
            onClick={() => setDrawerProduct("new")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add product
          </button>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        )}

        {error && (
          <p className="text-sm text-destructive py-4">
            Failed to load products. Check that migration 0013 has been applied.
          </p>
        )}

        {!isLoading && !error && products.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No products yet. Add your first one.
          </p>
        )}

        {!isLoading && products.length > 0 && (
          <div className="space-y-2">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={() => setDrawerProduct(product)}
                onToggle={() => {
                  toggleActive.mutate(
                    { id: product.id, is_active: !product.is_active },
                    {
                      onError: () => toast.error("Failed to update product."),
                    }
                  );
                }}
              />
            ))}
          </div>
        )}
      </section>

      <ProductDrawer
        product={drawerProduct === "new" ? null : drawerProduct}
        open={drawerProduct !== null}
        onOpenChange={(open) => !open && setDrawerProduct(null)}
      />

      {/* Referral Program section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
              Referral Program
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Members share their personal link. New customers get a % off their first drop-in class.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-sans text-foreground">Enable referral program</p>
              <p className="text-xs text-muted-foreground mt-0.5">Members can share links; new customers get a discount on their first class</p>
            </div>
            <button
              onClick={() => {
                const next = !(referralEnabled ?? studioReferralEnabled);
                setReferralEnabled(next);
                saveStudio.mutate({ referral_enabled: next }, {
                  onError: () => {
                    setReferralEnabled(null);
                    toast.error("Failed to save.");
                  },
                });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (referralEnabled ?? studioReferralEnabled) ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  (referralEnabled ?? studioReferralEnabled) ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Discount % */}
          {(referralEnabled ?? studioReferralEnabled) && (
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <div className="flex-1">
                <p className="text-sm font-sans text-foreground">Discount for new customer</p>
                <p className="text-xs text-muted-foreground mt-0.5">Applied to their first drop-in booking only</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={referralPct ?? studioReferralPct}
                  onChange={(e) => setReferralPct(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-sm text-center bg-background border border-border rounded-md"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {referralPct !== null && referralPct !== studioReferralPct && (
                  <button
                    onClick={() => {
                      saveStudio.mutate({ referral_discount_percent: referralPct }, {
                        onSuccess: () => setReferralPct(null),
                        onError: () => toast.error("Failed to save."),
                      });
                    }}
                    disabled={saveStudio.isPending}
                    className="text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Discount codes section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
            Discount Codes
          </h2>
          <button
            onClick={() => setAddCodeOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            {addCodeOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {addCodeOpen ? "Cancel" : "Add code"}
          </button>
        </div>

        {addCodeOpen && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Code *</label>
                <input
                  type="text"
                  value={newCode.code}
                  onChange={(e) => setNewCode((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER20"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md uppercase tracking-widest placeholder:normal-case"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={newCode.description ?? ""}
                  onChange={(e) => setNewCode((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Summer promo"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Type</label>
                <select
                  value={newCode.discount_type}
                  onChange={(e) => setNewCode((c) => ({ ...c, discount_type: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                >
                  <option value="percent">% off</option>
                  <option value="fixed_off">Fixed (NOK)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">
                  {newCode.discount_type === "percent" ? "Percent" : "Amount (NOK)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max={newCode.discount_type === "percent" ? "99" : undefined}
                  value={newCode.discount_value}
                  onChange={(e) => setNewCode((c) => ({ ...c, discount_value: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Max uses</label>
                <input
                  type="number"
                  min="1"
                  value={newCode.max_redemptions ?? ""}
                  onChange={(e) => setNewCode((c) => ({ ...c, max_redemptions: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-sans text-muted-foreground">Expires</label>
              <select
                value={newCode.valid_until ?? "never"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "never") { setNewCode((c) => ({ ...c, valid_until: null })); return; }
                  const months = Number(v);
                  const d = new Date();
                  d.setMonth(d.getMonth() + months);
                  setNewCode((c) => ({ ...c, valid_until: d.toISOString() }));
                }}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
              >
                <option value="never">Never</option>
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">1 year</option>
              </select>
            </div>
            <button
              onClick={handleCreateCode}
              disabled={createCode.isPending}
              className="w-full py-2 text-sm font-sans bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {createCode.isPending ? "Creating…" : "Create Code"}
            </button>
          </div>
        )}

        {codesLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        )}

        {codesError && (
          <p className="text-sm text-destructive py-4">
            Failed to load discount codes. Check that migration 0012 has been applied.
          </p>
        )}

        {!codesLoading && !codesError && discountCodes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No discount codes yet.
          </p>
        )}

        {!codesLoading && discountCodes.length > 0 && (
          <div className="space-y-2">
            {discountCodes.map((code) => (
              <DiscountCodeRow
                key={code.id}
                code={code}
                onToggle={() =>
                  toggleCode.mutate(
                    { id: code.id, is_active: !code.is_active },
                    { onError: () => toast.error("Failed to update code.") }
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DiscountCodeRow({ code, onToggle }: { code: DiscountCode; onToggle: () => void }) {
  const discountLabel =
    code.discount_type === "percent"
      ? `${code.discount_value}% off`
      : `NOK ${code.discount_value} off`;

  const meta = [
    discountLabel,
    code.times_redeemed ? `${code.times_redeemed} uses` : "0 uses",
    code.max_redemptions ? `max ${code.max_redemptions}` : null,
    code.valid_until
      ? `expires ${new Date(code.valid_until).toLocaleDateString("nb-NO")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${
        code.is_active ? "" : "opacity-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-foreground tracking-widest">{code.code}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
      {code.description && (
        <p className="text-xs text-muted-foreground font-sans hidden sm:block shrink-0 max-w-[160px] truncate">
          {code.description}
        </p>
      )}
      <button
        onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${
          code.is_active
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {code.is_active ? "Active" : "Inactive"}
      </button>
    </div>
  );
}

function ProductRow({
  product,
  onEdit,
  onToggle,
}: {
  product: Product;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const priceNOK = (product.price_minor / 100).toLocaleString("nb-NO");
  const currency = product.currency ?? "NOK";

  const meta = [
    TYPE_LABEL[product.type] ?? product.type,
    product.credits ? `${product.credits} credits` : null,
    product.validity_days ? `${product.validity_days} days` : null,
    product.billing_interval === "month" ? "monthly" : null,
    product.commitment_months ? `${product.commitment_months}-month commitment` : null,
    product.requires_contact ? "contact only" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${
        product.is_active ? "" : "opacity-50"
      }`}
    >
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-serif truncate">{product.name}</p>
          {product.tag && (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-sans uppercase tracking-wide">
              {product.tag}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>

      {/* Price */}
      <p className="text-sm font-serif shrink-0">
        {currency} {priceNOK}
        {product.billing_interval === "month" ? "/mo" : ""}
      </p>

      {/* Active toggle */}
      <button
        onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${
          product.is_active
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {product.is_active ? "Active" : "Inactive"}
      </button>

      {/* Edit */}
      <button
        onClick={onEdit}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Edit product"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
