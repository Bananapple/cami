import { useEffect, useRef, useState } from "react";

export type MenuItem = {
  id: string;
  label: string;
  group?: 1 | 2 | 3;
  danger?: boolean;
  /** Suffix label with "…" — opens AlertDialog after click */
  dialog?: boolean;
};

export function OverflowMenu({
  items,
  onAction,
}: {
  items: MenuItem[];
  onAction: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Group items by group number, then render with group dividers
  const groups = [1, 2, 3].map((g) => items.filter((i) => (i.group ?? 1) === g));

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Dots />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 180,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-card)",
            boxShadow: "0 8px 24px rgba(20,18,16,0.10)",
            padding: 4,
            zIndex: 20,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {groups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && group.length > 0 && groups[gi - 1].length > 0 && (
                <div style={{ height: 1, background: "var(--line-soft)", margin: "4px 0" }} />
              )}
              {group.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onAction(item.id);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    border: 0,
                    background: "transparent",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: item.danger ? "var(--bad)" : "var(--ink)",
                    borderRadius: "var(--r-input)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {item.label}
                  {item.dialog ? "…" : ""}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dots() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3.5" cy="8" r="1" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="12.5" cy="8" r="1" />
    </svg>
  );
}
