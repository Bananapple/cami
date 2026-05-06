import type { ReactNode } from "react";

// ── StateBadge ──────────────────────────────────────────────────────
// Colored capsule with leading dot. Reserved for state.

export type StateBadgeTone = "good" | "warn" | "bad" | "info" | "neutral";

export function StateBadge({ tone = "neutral", children }: { tone?: StateBadgeTone; children: ReactNode }) {
  return <span className={`sm-state ${tone}`}>{children}</span>;
}

// ── CategoryChip ────────────────────────────────────────────────────
// Soft-fill capsule, no border. Color-coded by semantic category.

export type CategoryChipVariant = "default" | "plan" | "frequency" | "time" | "level";

export function CategoryChip({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: CategoryChipVariant;
}) {
  return <span className={`sm-cat${variant !== "default" ? ` ${variant}` : ""}`}>{children}</span>;
}

// ── Count ───────────────────────────────────────────────────────────
// Bare tabular numeral, NOT a pill.

export type CountTone = "default" | "warn" | "danger";

export function Count({
  value,
  label,
  tone = "default",
}: {
  value: number | string;
  label?: string;
  tone?: CountTone;
}) {
  const cls = ["sm-count", tone === "warn" ? "warn" : "", tone === "danger" ? "danger" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      <span className="n">{value}</span>
      {label && <span>{label}</span>}
    </span>
  );
}
