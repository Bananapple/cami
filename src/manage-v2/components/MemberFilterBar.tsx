import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SectionEyebrow } from "./SectionEyebrow";
import {
  SEGMENTS,
  TAG_LABELS,
  PLAN_LABELS,
  TIME_LABELS,
  FREQUENCY_LABELS,
  tagValueLabel,
  type SegmentKey,
  type TagKey,
  type TagFilter,
  type ClientsFilter,
  type MemberSummary,
  type FrequencyTier,
} from "@/manage/hooks/useClientsView";

// Inline command-bar that replaces the search + lifecycle-pill row on the
// Clients page. Pills live INSIDE the input. Click a pill to remove it (no X
// icon by design — hover tint signals affordance). Backspace at empty input
// removes the trailing pill. Free-text + every pill AND-combine.
//
// Hand-rolled (not shadcn's Command) to match the v2 visual treatment used by
// CommandPalette.tsx — warm cream surface, Inter medium, action-soft tint on
// hover, no dark scrim.

type Suggestion =
  | { kind: "member"; member: MemberSummary }
  | { kind: "lifecycle"; key: SegmentKey; label: string; count: number }
  | { kind: "tag"; tag: TagFilter; label: string; count: number };

type Section = { heading: string; items: Suggestion[] };

const FREQUENCY_ORDER: FrequencyTier[] = ["devotee", "regular", "casual", "none"];
const TIME_ORDER = ["morning", "midday", "evening"];
const PLAN_ORDER = ["subscription", "clip_card", "drop_in", "private", "addon"];

export function MemberFilterBar({
  filter,
  onChange,
  members,
  segmentCounts,
  tagCounts,
  classNames,
  filtered,
  onSelectMember,
  onRemoveTag,
  onPopPill,
  onSetLifecycle,
}: {
  filter: ClientsFilter;
  onChange: (next: ClientsFilter) => void;
  members: MemberSummary[];
  segmentCounts: Record<SegmentKey, number>;
  tagCounts: Record<TagKey, Record<string, number>>;
  classNames: Record<string, string>;
  filtered: MemberSummary[]; // member matches that already respect active filters
  onSelectMember: (userId: string) => void;
  onRemoveTag: (tag: TagFilter) => void;
  onPopPill: () => void;
  onSetLifecycle: (key: SegmentKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = filter.text;
  const q = text.trim().toLowerCase();

  // Build suggestions on every input change. Sections + items collapse when
  // empty (auto-hide). Suggestions are filtered by the typed text.
  const sections: Section[] = useMemo(() => {
    const out: Section[] = [];
    const matches = (label: string) => !q || label.toLowerCase().includes(q);

    // Members — top 3 from already-filtered set if no text, otherwise top 3 by
    // text match against full member list (so search reveals members the
    // current pills would hide). Keep this short so tag sections stay above
    // the fold in the suggestions panel.
    const memberPool = q
      ? members
          .filter(
            (m) =>
              m.full_name?.toLowerCase().includes(q) ||
              m.email?.toLowerCase().includes(q) ||
              m.phone_number?.toLowerCase().includes(q),
          )
          .slice(0, 3)
      : filtered.slice(0, 3);

    if (memberPool.length > 0) {
      out.push({
        heading: "Members",
        items: memberPool.map((m) => ({ kind: "member", member: m })),
      });
    }

    // Lifecycle — exclude active + 'all' + zero-count.
    const lifecycleItems: Suggestion[] = SEGMENTS
      .filter((s) => s.key !== "all" && s.key !== filter.lifecycle)
      .filter((s) => (segmentCounts[s.key] ?? 0) > 0)
      .filter((s) => matches(s.label))
      .map((s) => ({
        kind: "lifecycle" as const,
        key: s.key,
        label: s.label,
        count: segmentCounts[s.key] ?? 0,
      }));
    if (lifecycleItems.length > 0) out.push({ heading: "Lifecycle", items: lifecycleItems });

    // Tags — Plan / Frequency / Source / Time / Class.
    const tagSection = (
      key: TagKey,
      heading: string,
      orderedValues: string[] | null,
      labelOf: (v: string) => string,
    ): Section | null => {
      const valuesObj = tagCounts[key] ?? {};
      const values = Object.keys(valuesObj);
      if (orderedValues) values.sort((a, b) => orderedValues.indexOf(a) - orderedValues.indexOf(b));
      else values.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));

      const items: Suggestion[] = values
        .filter((v) => (valuesObj[v] ?? 0) > 0)
        .filter((v) => !filter.tags.some((t) => t.key === key && t.value === v))
        .filter((v) => matches(labelOf(v)))
        .map((v) => ({
          kind: "tag" as const,
          tag: { key, value: v },
          label: labelOf(v),
          count: valuesObj[v] ?? 0,
        }));
      return items.length > 0 ? { heading, items } : null;
    };

    const plan = tagSection("plan", "Plan", PLAN_ORDER, (v) => PLAN_LABELS[v] ?? v);
    if (plan) out.push(plan);

    const freq = tagSection("frequency", "Frequency", FREQUENCY_ORDER, (v) => FREQUENCY_LABELS[v as FrequencyTier] ?? v);
    if (freq) out.push(freq);

    const src = tagSection("source", "Source", null, (v) =>
      v.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    );
    if (src) out.push(src);

    const time = tagSection("time", "Time", TIME_ORDER, (v) => TIME_LABELS[v] ?? v);
    if (time) out.push(time);

    const cls = tagSection("class", "Class", null, (v) => classNames[v] ?? v);
    if (cls) out.push(cls);

    return out;
  }, [q, members, filtered, segmentCounts, tagCounts, filter, classNames]);

  // Flatten for keyboard nav.
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setActiveIndex(0);
  }, [q, filter]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const activate = (sug: Suggestion) => {
    // Single source of truth: drive state through onChange only. The hook's
    // convenience setters (onAddTag/onSetLifecycle) duplicate this work and
    // were previously called in tandem, which made it ambiguous which path
    // owns the update.
    if (sug.kind === "member") {
      onSelectMember(sug.member.user_id);
      onChange({ ...filter, text: "" });
      setOpen(false);
      return;
    }
    if (sug.kind === "lifecycle") {
      onChange({ ...filter, text: "", lifecycle: sug.key });
      return;
    }
    if (sug.kind === "tag") {
      const exists = filter.tags.some(
        (t) => t.key === sug.tag.key && t.value === sug.tag.value,
      );
      onChange({
        ...filter,
        text: "",
        tags: exists ? filter.tags : [...filter.tags, sug.tag],
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && text === "") {
      e.preventDefault();
      onPopPill();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const sug = flat[activeIndex];
      if (sug) {
        e.preventDefault();
        activate(sug);
      }
    }
  };

  const lifecyclePill =
    filter.lifecycle !== "all"
      ? SEGMENTS.find((s) => s.key === filter.lifecycle)
      : null;

  const placeholder =
    filter.lifecycle === "all" && filter.tags.length === 0
      ? "Search or filter members…"
      : "";

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: 12 }}>
      {/* Input + pills */}
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        style={{
          display: "flex",
          flexWrap: "wrap",
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
        {lifecyclePill && (
          <Pill onClick={() => onSetLifecycle("all")}>{lifecyclePill.label}</Pill>
        )}
        {filter.tags.map((t) => (
          <Pill key={`${t.key}:${t.value}`} onClick={() => onRemoveTag(t)}>
            <span style={{ color: "var(--ink-muted)", marginRight: 4 }}>
              {TAG_LABELS[t.key]}:
            </span>
            {t.key === "class"
              ? classNames[t.value] ?? t.value
              : tagValueLabel(t.key, t.value)}
          </Pill>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: 120,
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

      {/* Suggestions panel */}
      {open && (
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
          {flat.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "16px 16px",
                fontSize: 13,
                color: "var(--ink-muted)",
                textAlign: "center",
              }}
            >
              {q ? `No matches for "${q}".` : "No suggestions."}
            </p>
          )}
          {(() => {
            let runningIndex = -1;
            return sections.map((sec) => (
              <div key={sec.heading} style={{ padding: "6px 0" }}>
                <SectionEyebrow style={{ padding: "6px 14px 4px" }}>
                  {sec.heading}
                </SectionEyebrow>
                {sec.items.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  const myIndex = runningIndex;
                  return (
                    <button
                      key={suggestionKey(item)}
                      type="button"
                      onMouseEnter={() => setActiveIndex(myIndex)}
                      onClick={() => activate(item)}
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
                      <SuggestionRow item={item} classNames={classNames} />
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

function suggestionKey(s: Suggestion): string {
  if (s.kind === "member") return `member:${s.member.user_id}`;
  if (s.kind === "lifecycle") return `lifecycle:${s.key}`;
  return `tag:${s.tag.key}:${s.tag.value}`;
}

function SuggestionRow({
  item,
  classNames,
}: {
  item: Suggestion;
  classNames: Record<string, string>;
}) {
  if (item.kind === "member") {
    const initials = (item.member.full_name ?? "?")
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <>
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
            {item.member.full_name}
          </span>
          {item.member.email && (
            <span style={{ display: "block", fontSize: 12, color: "var(--ink-muted)" }}>
              {item.member.email}
            </span>
          )}
        </span>
      </>
    );
  }

  const heading =
    item.kind === "lifecycle" ? "Lifecycle" : TAG_LABELS[item.tag.key];

  return (
    <>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13.5, color: "var(--ink)" }}>
          <span style={{ color: "var(--ink-muted)", marginRight: 6 }}>{heading}:</span>
          {item.label}
        </span>
      </span>
      <span style={{ fontSize: 12, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
        {item.count}
      </span>
    </>
  );
}

function Pill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
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
