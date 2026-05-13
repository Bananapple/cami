import { useEffect, useRef, useState, type ReactNode } from "react";
import { type ClientsFilter, type MemberSummary } from "@/manage/hooks/useClientsView";

export function MemberFilterBar({
  filter,
  onChange,
  members,
  filtered,
  onSelectMember,
}: {
  filter: ClientsFilter;
  onChange: (next: ClientsFilter) => void;
  members: MemberSummary[];
  filtered: MemberSummary[];
  onSelectMember: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = filter.text;
  const q = text.trim().toLowerCase();

  // Top 3 member matches for the suggestion panel.
  const suggestions = q
    ? members
        .filter(
          (m) =>
            m.full_name?.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.phone_number?.toLowerCase().includes(q),
        )
        .slice(0, 5)
    : filtered.slice(0, 5);

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const activate = (member: MemberSummary) => {
    onSelectMember(member.user_id);
    onChange({ text: "" });
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const m = suggestions[activeIndex];
      if (m) {
        e.preventDefault();
        activate(m);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: 12 }}>
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minHeight: 36,
          padding: "5px 10px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-input)",
          cursor: "text",
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="Search members…"
          style={{
            flex: 1,
            border: 0,
            outline: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: 13,
            color: "var(--ink)",
            padding: "2px 0",
          }}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-large)",
            boxShadow: "0 8px 24px rgba(20,18,16,0.08)",
            maxHeight: "60vh",
            overflow: "auto",
            padding: "6px 0",
          }}
        >
          {suggestions.map((member, idx) => {
            const isActive = idx === activeIndex;
            const initials = (member.full_name ?? "?")
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <button
                key={member.user_id}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => activate(member)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 14px",
                  border: 0,
                  background: isActive ? "var(--action-soft)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10.5,
                    color: "var(--ink-soft)",
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                    {member.full_name}
                  </span>
                  {member.email && (
                    <span style={{ display: "block", fontSize: 12, color: "var(--ink-muted)" }}>
                      {member.email}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
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

// Keep Pill exported in case it's used elsewhere
export function Pill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "0 10px",
        border: "1px solid var(--line)",
        background: hover ? "var(--action-soft)" : "var(--surface-2)",
        color: "var(--ink)",
        borderRadius: 999,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
