import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { OverflowMenu } from "../components/OverflowMenu";
import { EmptyState } from "../components/EmptyState";
import { useManageProducts, type Product } from "@/manage/hooks/useManageProducts";
import { useManageInstructors, type ManagedInstructor } from "@/manage/hooks/useManageInstructors";
import { useManageLocations, type ManagedLocation } from "@/manage/hooks/useManageLocations";
import { useStudioContext } from "@/context/StudioContext";
import { useMyStudioRole } from "@/manage/hooks/useMyStudioRole";
import { ProductDrawerV2 } from "../drawers/ProductDrawer";
import { InstructorDrawerV2 } from "../drawers/InstructorDrawer";
import { LocationDrawerV2 } from "../drawers/LocationDrawer";

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

  const [productDrawer, setProductDrawer] = useState<DrawerState<Product>>(null);
  const [instructorDrawer, setInstructorDrawer] = useState<DrawerState<ManagedInstructor>>(null);
  const [locationDrawer, setLocationDrawer] = useState<DrawerState<ManagedLocation>>(null);

  return (
    <>
      <PageHeader
        title="Studio"
        subtitle="Products, instructors, and locations"
        actions={<Button variant="secondary">Studio settings</Button>}
      />

      {/* Products */}
      <section className="sm-section">
        <SectionHead title="Products" cta="Add product" onClick={() => setProductDrawer({ mode: "create" })} />
        <RowList>
          {pLoading && <LoadingRow text="Loading products…" />}
          {!pLoading && products.length === 0 && (
            <EmptyState title="No products yet" hint="Add your first drop-in or clip card to start selling." />
          )}
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              currency={currency}
              onEdit={() => setProductDrawer({ mode: "edit", entity: p })}
              onToggle={() => toggleProduct.mutate({ id: p.id, is_active: !p.is_active })}
            />
          ))}
        </RowList>
      </section>

      {/* Instructors */}
      <section className="sm-section">
        <SectionHead title="Instructors" cta="Add instructor" onClick={() => setInstructorDrawer({ mode: "create" })} />
        <RowList>
          {iLoading && <LoadingRow text="Loading instructors…" />}
          {!iLoading && instructors.length === 0 && (
            <EmptyState title="No instructors yet" hint="Add your team to assign them to classes." />
          )}
          {instructors.map((i) => (
            <InstructorRow
              key={i.id}
              instructor={i}
              onEdit={() => setInstructorDrawer({ mode: "edit", entity: i })}
              onToggle={() => toggleInstructor.mutate({ id: i.id, is_active: !i.is_active })}
            />
          ))}
        </RowList>
      </section>

      {/* Locations */}
      <section className="sm-section">
        <SectionHead title="Locations" cta="Add location" onClick={() => setLocationDrawer({ mode: "create" })} />
        <RowList>
          {lLoading && <LoadingRow text="Loading locations…" />}
          {!lLoading && locations.length === 0 && (
            <EmptyState title="No locations yet" hint="Add a room to schedule classes against it." />
          )}
          {locations.map((l) => (
            <LocationRow
              key={l.id}
              location={l}
              onEdit={() => setLocationDrawer({ mode: "edit", entity: l })}
              onToggle={() => toggleLocation.mutate({ id: l.id, is_active: !l.is_active })}
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
    </>
  );
}

// ── Section header ─────────────────────────────────────────────────
function SectionHead({ title, cta, onClick }: { title: string; cta: string; onClick: () => void }) {
  return (
    <div className="sm-section-head">
      <h2>{title}</h2>
      <Button variant="ghost" size="sm" onClick={onClick}>+ {cta}</Button>
    </div>
  );
}

// ── Loading row placeholder ─────────────────────────────────────────
function LoadingRow({ text }: { text: string }) {
  return (
    <div style={{ padding: "16px 14px", color: "var(--ink-muted)", fontSize: 13 }}>
      {text}
    </div>
  );
}

// ── Product row ────────────────────────────────────────────────────
function ProductRow({
  product,
  currency,
  onEdit,
  onToggle,
}: {
  product: Product;
  currency: string;
  onEdit: () => void;
  onToggle: () => void;
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
      titleSuffix={<CategoryChip>{TYPE_LABEL[product.type] ?? product.type}</CategoryChip>}
      meta={meta || "—"}
      trail={
        <>
          <span style={{ fontSize: 14, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
            {priceFormatted}
            {product.billing_interval === "month" ? <span style={{ color: "var(--ink-muted)" }}>/mo</span> : null}
          </span>
          <StateBadge tone={product.is_active ? "good" : "neutral"}>
            {product.is_active ? "Active" : "Inactive"}
          </StateBadge>
          <OverflowMenu
            items={[
              { id: "edit", label: "Edit", group: 1 },
              {
                id: "toggle",
                label: product.is_active ? "Deactivate" : "Activate",
                group: 2,
              },
            ]}
            onAction={(id) => {
              if (id === "toggle") onToggle();
              else if (id === "edit") onEdit();
            }}
          />
        </>
      }
      onSelect={onEdit}
    />
  );
}

function ProductGlyph({ type }: { type: string }) {
  const ch = type === "subscription" ? "♾" : type === "clip_card" ? "▦" : type === "private" ? "✦" : "◉";
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        color: "var(--ink-soft)",
      }}
    >
      {ch}
    </span>
  );
}

// ── Instructor row ──────────────────────────────────────────────────
function InstructorRow({
  instructor,
  onEdit,
  onToggle,
}: {
  instructor: ManagedInstructor;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const statusBadge = (() => {
    if (!instructor.is_active) return <StateBadge tone="neutral">Inactive</StateBadge>;
    if (instructor.status === "on_leave") return <StateBadge tone="warn">On leave</StateBadge>;
    return <StateBadge tone="good">Active</StateBadge>;
  })();

  return (
    <Row
      lead={
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "var(--ink-soft)",
            fontWeight: 500,
          }}
        >
          {instructor.initials}
        </span>
      }
      title={instructor.display_name}
      meta={instructor.specialty ?? "—"}
      trail={
        <>
          {statusBadge}
          <OverflowMenu
            items={[
              { id: "edit", label: "Edit", group: 1 },
              { id: "toggle", label: instructor.is_active ? "Deactivate" : "Activate", group: 2 },
            ]}
            onAction={(id) => {
              if (id === "toggle") onToggle();
              else if (id === "edit") onEdit();
            }}
          />
        </>
      }
      onSelect={onEdit}
    />
  );
}

// ── Location row ────────────────────────────────────────────────────
function LocationRow({
  location,
  onEdit,
  onToggle,
}: {
  location: ManagedLocation;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <Row
      lead={
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "var(--ink-soft)",
          }}
        >
          📍
        </span>
      }
      title={location.name}
      meta={[location.address, `${location.default_capacity} capacity`].filter(Boolean).join(" · ")}
      trail={
        <>
          <Count value={location.default_capacity} label="capacity" />
          <StateBadge tone={location.is_active ? "good" : "neutral"}>
            {location.is_active ? "Active" : "Inactive"}
          </StateBadge>
          <OverflowMenu
            items={[
              { id: "edit", label: "Edit", group: 1 },
              { id: "toggle", label: location.is_active ? "Deactivate" : "Activate", group: 2 },
            ]}
            onAction={(id) => {
              if (id === "toggle") onToggle();
              else if (id === "edit") onEdit();
            }}
          />
        </>
      }
      onSelect={onEdit}
    />
  );
}
