import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// ── CommandPalette ─────────────────────────────────────────────────
// ⌘K-triggered search overlay. Surface treatment matches v2:
//   - warm cream background (--surface), 1px --line border
//   - NO dark scrim — soft tinted backdrop only
//   - section eyebrows uppercase tracking-wider muted
//   - selected/hovered row: --action-soft tint, never solid fill
//   - result row mirrors the Row primitive (Inter medium name + muted secondary)

export type CommandItem = {
  id: string;
  /** Section grouping ("Members", "Classes", "Settings") */
  group: string;
  /** Primary label — Inter medium */
  label: string;
  /** Optional secondary text shown muted */
  meta?: string;
  /** Optional lead glyph or initials */
  lead?: ReactNode;
  /** Action fired on Enter / click */
  onSelect: () => void;
};

export function CommandPalette({
  open,
  onClose,
  items,
  placeholder = "Search members, classes, settings…",
}: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter + group items by current query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.meta?.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Reset query when closed; reset selection when filter changes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    } else {
      // focus next tick to avoid Esc race with the keyboard handler
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, activeIndex, onClose]);

  // Auto-scroll to keep active item visible
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-cmd-active="true"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, query]);

  if (!open) return null;

  // Flatten grouped into an index map so each visible item has a stable
  // index for keyboard nav even though it's rendered grouped.
  let runningIndex = -1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20, 18, 16, 0.06)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "10vh 16px 16px",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-large)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid var(--line-soft)",
          }}
        >
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              border: 0,
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: 15,
              color: "var(--ink)",
            }}
          />
          <kbd
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              padding: "2px 6px",
              borderRadius: 3,
              background: "var(--surface-2)",
              border: "1px solid var(--line-soft)",
              color: "var(--ink-muted)",
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflow: "auto", flex: 1, padding: "6px 0" }}>
          {filtered.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "32px 20px",
                textAlign: "center",
                color: "var(--ink-muted)",
                fontSize: 13,
              }}
            >
              No results for "{query}".
            </p>
          )}
          {grouped.map(([group, groupItems]) => (
            <div key={group} style={{ padding: "6px 0" }}>
              <div
                style={{
                  padding: "6px 16px 4px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--ink-muted)",
                  fontWeight: 600,
                }}
              >
                {group}
              </div>
              {groupItems.map((item) => {
                runningIndex += 1;
                const isActive = runningIndex === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cmd-active={isActive}
                    onMouseEnter={() => setActiveIndex(runningIndex)}
                    onClick={() => {
                      item.onSelect();
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "10px 16px",
                      border: 0,
                      background: isActive ? "var(--action-soft)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    {item.lead && (
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
                          flexShrink: 0,
                        }}
                      >
                        {item.lead}
                      </span>
                    )}
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--ink)",
                          lineHeight: 1.3,
                        }}
                      >
                        {item.label}
                      </span>
                      {item.meta && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            color: "var(--ink-muted)",
                            marginTop: 2,
                            lineHeight: 1.3,
                          }}
                        >
                          {item.meta}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--line-soft)",
            background: "var(--surface-2)",
            display: "flex",
            gap: 16,
            fontSize: 11.5,
            color: "var(--ink-muted)",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

// ── Hook: register ⌘K (or Ctrl+K) globally ─────────────────────────
export function useCommandPaletteShortcut(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--ink-muted)", flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}
