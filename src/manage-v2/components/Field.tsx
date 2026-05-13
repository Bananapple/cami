import type { ReactNode } from "react";

export function Field({
  label,
  help,
  error,
  children,
}: {
  label?: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {label}
        </label>
      )}
      {children}
      {(error || help) && (
        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            color: error ? "var(--bad)" : "var(--ink-muted)",
            lineHeight: 1.4,
          }}
        >
          {error || help}
        </p>
      )}
    </div>
  );
}

// FieldRow — two-up only
export function FieldRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {children}
    </div>
  );
}

// Shared input styling — 32px height, 1px line, 6px radius
// eslint-disable-next-line react-refresh/only-export-components
export const inputStyle: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  fontSize: 13,
  color: "var(--ink)",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-input)",
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};
