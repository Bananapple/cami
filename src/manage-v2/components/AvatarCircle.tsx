import type { ReactNode } from "react";

const SIZE_FONT: Record<number, number> = {
  28: 11,
  32: 12,
  36: 13,
  44: 14,
};

export function AvatarCircle({
  children,
  size = 28,
  fontSize,
  fontWeight = 500,
  letterSpacing,
}: {
  children: ReactNode;
  size?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: string;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? SIZE_FONT[size] ?? 11,
        color: "var(--ink-soft)",
        fontWeight,
        letterSpacing,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
