import { type ReactNode, type CSSProperties } from "react";

export function RowList({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="sm-list" style={style}>
      {children}
    </div>
  );
}

export type RowProps = {
  /** Lead slot — Avatar (28×28), tabular time string, numeric prefix, or null */
  lead?: ReactNode;
  /** Required title — 14px / 500. Inline category chip allowed via `titleSuffix` */
  title: ReactNode;
  /** Optional inline element rendered next to the title (e.g. CategoryChip) */
  titleSuffix?: ReactNode;
  /** Optional second line — 13px / muted */
  meta?: ReactNode;
  /** Right column — Count, StateBadge, OverflowMenu in that order */
  trail?: ReactNode;
  /** Called when the row body is clicked — opens drawer */
  onSelect?: () => void;
  /** Applies --surface-2 tint (e.g. when its drawer is open) */
  selected?: boolean;
  /** When true, render as <div> not <button> — for non-clickable rows */
  static?: boolean;
};

export function Row({
  lead,
  title,
  titleSuffix,
  meta,
  trail,
  onSelect,
  selected,
  static: isStatic,
}: RowProps) {
  const className = "sm-row" + (selected ? " on" : "");

  const inner = (
    <>
      {lead !== undefined && lead !== null && (
        <span className={typeof lead === "string" ? "lead time" : "lead"}>{lead}</span>
      )}
      <div className="body">
        <div className="title">
          {title}
          {titleSuffix}
        </div>
        {meta && <div className="meta-line">{meta}</div>}
      </div>
      {trail && <div className="trail">{trail}</div>}
    </>
  );

  if (isStatic) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button className={className} type="button" onClick={onSelect}>
      {inner}
    </button>
  );
}

// ── Avatar ──────────────────────────────────────────────────────────
// 28×28 lead initials. Used in member rows.

export function Avatar({ initials, size = "sm" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  if (size === "md") return <div className="sm-av-md">{initials}</div>;
  if (size === "lg") return <div className="sm-av-lg">{initials}</div>;
  // sm (28px) lives inside the row's .lead slot
  return <>{initials}</>;
}
