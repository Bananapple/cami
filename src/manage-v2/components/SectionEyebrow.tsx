import type { CSSProperties, ReactNode } from "react";

// Section eyebrow — uppercase 11px Inter 600 with --ink-muted color and 0.12em
// tracking. Used as the heading above grouped content in drawers, command
// palettes, and the inline filter bar. Centralized here so the recipe doesn't
// drift across surfaces.

export function SectionEyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--ink-muted)",
        fontWeight: 600,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
