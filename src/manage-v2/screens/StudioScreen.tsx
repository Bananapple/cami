import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { SectionHead } from "../shell/SectionHead";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { AvatarCircle } from "../components/AvatarCircle";
import { LoadingPlaceholder } from "../components/LoadingPlaceholder";
import { useManageProducts, type Product } from "@/manage/hooks/useManageProducts";
import { useManageInstructors, type ManagedInstructor } from "@/manage/hooks/useManageInstructors";
import { useManageLocations, type ManagedLocation } from "@/manage/hooks/useManageLocations";
import { useManageDiscountCodes, type DiscountCode } from "@/manage/hooks/useManageDiscountCodes";
import { useManageStudio } from "@/manage/hooks/useManageStudio";
import { useStudioContext } from "@/context/StudioContext";
import { useMyStudioRole } from "@/manage/hooks/useMyStudioRole";
import { ProductDrawerV2 } from "../drawers/ProductDrawer";
import { InstructorDrawerV2 } from "../drawers/InstructorDrawer";
import { LocationDrawerV2 } from "../drawers/LocationDrawer";
import { DiscountCodeDrawer } from "../drawers/DiscountCodeDrawer";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  drop_in: "Drop-in",
  clip_card: "Clip card",
  subscription: "Subscription",
  private: "Private",
  addon: "Add-on",
};

type DrawerState<T> = { mode: "create" } | { mode: "edit"; entity: T } | null;

export function StudioScreen() {
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";
  const { data: myRole } = useMyStudioRole();
  const isOwner = myRole === "owner";

  const { data: products = [], isLoading: pLoading, toggleActive: toggleProduct } = useManageProducts();
  const { instructors, isLoading: iLoading, toggleActive: toggleInstructor } = useManageInstructors();
  const { locations, isLoading: lLoading, toggleActive: toggleLocation } = useManageLocations();
  const { data: discountCodes = [], isLoading: dcLoading } = useManageDiscountCodes();
  const { studio, save: saveStudio } = useManageStudio();

  const [productDrawer, setProductDrawer] = useState<DrawerState<Product>>(null);
  const [instructorDrawer, setInstructorDrawer] = useState<DrawerState<ManagedInstructor>>(null);
  const [locationDrawer, setLocationDrawer] = useState<DrawerState<ManagedLocation>>(null);
  const [codeDrawer, setCodeDrawer] = useState<{ mode: "create" } | { mode: "edit"; code: DiscountCode } | null>(null);

  const referralEnabled = (studio as any)?.referral_enabled ?? false;
  const referralPct = (studio as any)?.referral_discount_percent ?? 10;
  const [localPct, setLocalPct] = useState<string | null>(null);
  const displayPct = localPct ?? String(referralPct);

  const handleReferralToggle = async () => {
    try {
      await saveStudio.mutateAsync({ referral_enabled: !referralEnabled });
    } catch {
      toast.error("Failed to update referral setting.");
    }
  };

  const handlePctSave = async () => {
    const val = Number(displayPct);
    if (!val || val < 1 || val > 99) { toast.error("Enter a value between 1–99."); return; }
    try {
      await saveStudio.mutateAsync({ referral_discount_percent: val });
      setLocalPct(null);
      toast.success("Referral discount updated.");
    } catch {
      toast.error("Failed to update.");
    }
  };

  return (
    <>
      <PageHeader
        title="Studio"
        subtitle="Products, instructors, and locations"
      />

      {/* Products */}
      <section className="sm-section">
        <SectionHead title="Products" cta="Add product" onClick={() => setProductDrawer({ mode: "create" })} />
        <RowList>
          {pLoading && <LoadingPlaceholder text="Loading products…" />}
          {!pLoading && products.length === 0 && (
            <EmptyState title="No products yet" hint="Add your first drop-in or clip card to start selling." />
          )}
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              currency={currency}
              onEdit={() => setProductDrawer({ mode: "edit", entity: p })}
            />
          ))}
        </RowList>
      </section>

      {/* Instructors */}
      <section className="sm-section">
        <SectionHead title="Instructors" cta="Add instructor" onClick={() => setInstructorDrawer({ mode: "create" })} />
        <RowList>
          {iLoading && <LoadingPlaceholder text="Loading instructors…" />}
          {!iLoading && instructors.length === 0 && (
            <EmptyState title="No instructors yet" hint="Add your team to assign them to classes." />
          )}
          {instructors.map((i) => (
            <InstructorRow
              key={i.id}
              instructor={i}
              onEdit={() => setInstructorDrawer({ mode: "edit", entity: i })}
            />
          ))}
        </RowList>
      </section>

      {/* Locations */}
      <section className="sm-section">
        <SectionHead title="Locations" cta="Add location" onClick={() => setLocationDrawer({ mode: "create" })} />
        <RowList>
          {lLoading && <LoadingPlaceholder text="Loading locations…" />}
          {!lLoading && locations.length === 0 && (
            <EmptyState title="No locations yet" hint="Add a room to schedule classes against it." />
          )}
          {locations.map((l) => (
            <LocationRow
              key={l.id}
              location={l}
              onEdit={() => setLocationDrawer({ mode: "edit", entity: l })}
            />
          ))}
        </RowList>
      </section>

      {/* Referral Program */}
      <section className="sm-section">
        <SectionHead title="Referral program" />
        <div className="sm-setting-card">
          <div className="sm-setting-row">
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Enable referral program</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>Members get a personal link to share with friends</div>
            </div>
            <button
              type="button"
              className={`sm-toggle${referralEnabled ? " on" : ""}`}
              onClick={handleReferralToggle}
              aria-label="Toggle referral program"
            />
          </div>
          <div className="sm-setting-row">
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>First-timer discount</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>Applied automatically when a referred new member checks out</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="1"
                max="99"
                value={displayPct}
                onChange={(e) => setLocalPct(e.target.value)}
                style={{ width: 56, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 14, textAlign: "right", background: "var(--surface)", color: "var(--ink)" }}
              />
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>%</span>
              {localPct !== null && (
                <Button variant="primary" size="sm" onClick={handlePctSave}>Save</Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Discount Codes */}
      <section className="sm-section">
        <SectionHead title="Discount codes" cta="Add code" onClick={() => setCodeDrawer({ mode: "create" })} />
        <RowList>
          {dcLoading && <LoadingPlaceholder text="Loading discount codes…" />}
          {!dcLoading && discountCodes.length === 0 && (
            <EmptyState title="No discount codes yet" hint="Create a code to offer a discount at checkout." />
          )}
          {discountCodes.map((dc) => (
            <DiscountCodeRow
              key={dc.id}
              code={dc}
              currency={currency}
              onEdit={() => setCodeDrawer({ mode: "edit", code: dc })}
            />
          ))}
        </RowList>
      </section>

      {/* Drawers */}
      <ProductDrawerV2
        mode={productDrawer?.mode ?? "create"}
        product={productDrawer?.mode === "edit" ? productDrawer.entity : null}
        open={!!productDrawer}
        onClose={() => setProductDrawer(null)}
      />
      <InstructorDrawerV2
        mode={instructorDrawer?.mode ?? "create"}
        instructor={instructorDrawer?.mode === "edit" ? instructorDrawer.entity : null}
        open={!!instructorDrawer}
        onClose={() => setInstructorDrawer(null)}
        isOwner={isOwner}
      />
      <LocationDrawerV2
        mode={locationDrawer?.mode ?? "create"}
        location={locationDrawer?.mode === "edit" ? locationDrawer.entity : null}
        open={!!locationDrawer}
        onClose={() => setLocationDrawer(null)}
      />
      <DiscountCodeDrawer
        mode={codeDrawer?.mode ?? "create"}
        code={codeDrawer?.mode === "edit" ? codeDrawer.code : null}
        open={!!codeDrawer}
        onClose={() => setCodeDrawer(null)}
      />
    </>
  );
}

// ── Product row ────────────────────────────────────────────────────
function ProductRow({
  product,
  currency,
  onEdit,
}: {
  product: Product;
  currency: string;
  onEdit: () => void;
}) {
  const priceFormatted = `${currency} ${(product.price_minor / 100).toLocaleString("nb-NO")}`;
  const meta = [
    product.credits ? `${product.credits} credits` : null,
    product.validity_days ? `${product.validity_days} days` : null,
    product.billing_interval === "month" ? "monthly" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Row
      lead={<ProductGlyph type={product.type} />}
      title={product.name}
      titleSuffix={<CategoryChip variant="plan">{TYPE_LABEL[product.type] ?? product.type}</CategoryChip>}
      meta={meta || "—"}
      trail={
        <div className="sm-trail-stack">
          <span style={{ fontSize: 14, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
            {priceFormatted}
            {product.billing_interval === "month" ? <span style={{ color: "var(--ink-muted)" }}>/mo</span> : null}
          </span>
          <StateBadge tone={product.is_active ? "good" : "neutral"}>
            {product.is_active ? "Active" : "Inactive"}
          </StateBadge>
        </div>
      }
      onSelect={onEdit}
    />
  );
}

function ProductGlyph({ type }: { type: string }) {
  const ch = type === "subscription" ? "♾" : type === "clip_card" ? "▦" : type === "private" ? "✦" : "◉";
  return <AvatarCircle fontSize={13} fontWeight={400}>{ch}</AvatarCircle>;
}

// ── Instructor row ──────────────────────────────────────────────────
function InstructorRow({
  instructor,
  onEdit,
}: {
  instructor: ManagedInstructor;
  onEdit: () => void;
}) {
  const statusBadge = (() => {
    if (!instructor.is_active) return <StateBadge tone="neutral">Inactive</StateBadge>;
    if (instructor.status === "on_leave") return <StateBadge tone="warn">On leave</StateBadge>;
    return <StateBadge tone="good">Active</StateBadge>;
  })();

  return (
    <Row
      lead={<AvatarCircle>{instructor.initials}</AvatarCircle>}
      title={instructor.display_name}
      meta={instructor.specialty ?? "—"}
      trail={statusBadge}
      onSelect={onEdit}
    />
  );
}

// ── Location row ────────────────────────────────────────────────────
function LocationRow({
  location,
  onEdit,
}: {
  location: ManagedLocation;
  onEdit: () => void;
}) {
  return (
    <Row
      lead={<AvatarCircle fontSize={13} fontWeight={400}>📍</AvatarCircle>}
      title={location.name}
      meta={[location.address, `${location.default_capacity} capacity`].filter(Boolean).join(" · ")}
      trail={
        <>
          <Count value={location.default_capacity} label="capacity" />
          <StateBadge tone={location.is_active ? "good" : "neutral"}>
            {location.is_active ? "Active" : "Inactive"}
          </StateBadge>
        </>
      }
      onSelect={onEdit}
    />
  );
}

// ── Discount code row ───────────────────────────────────────────────
function DiscountCodeRow({
  code,
  currency,
  onEdit,
}: {
  code: DiscountCode;
  currency: string;
  onEdit: () => void;
}) {
  const valueLabel =
    code.discount_type === "percent"
      ? `${code.discount_value}% off`
      : `${currency} ${code.discount_value.toLocaleString("nb-NO")} off`;

  const meta = [
    code.code,
    valueLabel,
    code.max_redemptions ? `${code.times_redeemed}/${code.max_redemptions} uses` : `${code.times_redeemed} uses`,
    code.valid_until ? `Expires ${new Date(code.valid_until).toLocaleDateString("nb-NO")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Row
      lead={<AvatarCircle fontWeight={600} letterSpacing="-0.02em">%</AvatarCircle>}
      title={code.description || code.code}
      meta={meta}
      trail={
        <StateBadge tone={code.is_active ? "good" : "neutral"}>
          {code.is_active ? "Active" : "Inactive"}
        </StateBadge>
      }
      onSelect={onEdit}
    />
  );
}
