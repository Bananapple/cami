import type { ReactNode } from "react";

// ── StateBadge ──────────────────────────────────────────────────────
// Colored capsule with leading dot. Reserved for state.

export type StateBadgeTone = "good" | "warn" | "bad" | "info" | "neutral";

export function StateBadge({ tone = "neutral", children }: { tone?: StateBadgeTone; children: ReactNode }) {
  return <span className={`sm-state ${tone}`}>{children}</span>;
}

// ── CategoryChip ────────────────────────────────────────────────────
// Neutral mono outline, no color. Uppercase, monospace.

export function CategoryChip({ children }: { children: ReactNode }) {
  return <span className="sm-cat">{children}</span>;
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
