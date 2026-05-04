import { useState } from "react";
import "../tokens/tokens.css";
import { Shell } from "../shell/Shell";
import { PageHeader } from "../shell/PageHeader";
import { Button } from "../components/Button";
import { Row, RowList } from "../components/Row";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { OverflowMenu } from "../components/OverflowMenu";
import type { NavId } from "../shell/NavRail";
import type { CommandItem } from "../components/CommandPalette";

const COMMAND_ITEMS: CommandItem[] = [
  { id: "m1", group: "Members", label: "Frida Kalo", meta: "frida@example.com · Active · 12 visits", lead: "FK", onSelect: () => alert("Open Frida Kalo") },
  { id: "m2", group: "Members", label: "Nico Vibe", meta: "nico@example.com · Active · 47 visits", lead: "NV", onSelect: () => alert("Open Nico Vibe") },
  { id: "c1", group: "Classes", label: "Bootylicious", meta: "Sun 4 May · 11:30 · Brikela", lead: "B", onSelect: () => {} },
  { id: "c2", group: "Classes", label: "Mysore", meta: "Sun 4 May · 09:00 · Mira Holm", lead: "M", onSelect: () => {} },
  { id: "s1", group: "Settings", label: "Discount codes", meta: "Manage promo codes and referrals", onSelect: () => {} },
  { id: "s2", group: "Settings", label: "Studio details", meta: "Branding, currency, timezone", onSelect: () => {} },
];

export function ShellPreview() {
  const [active, setActive] = useState<NavId>("schedule");

  return (
    <Shell
      active={active}
      onNavigate={setActive}
      brandName="Brikela"
      userInitials="NV"
      userName="Nico Vibe"
      commandItems={COMMAND_ITEMS}
    >
      <PageHeader
        title="Schedule"
        subtitle="Next 4 weeks · 32 classes scheduled"
        actions={
          <>
            <Button variant="secondary">Edit sequence</Button>
            <Button variant="primary">Add one-off class</Button>
          </>
        }
      />

      {/* Long content to verify rail stays fixed when content scrolls */}
      {Array.from({ length: 4 }).map((_, dayIdx) => (
        <div key={dayIdx} className="sm-day">
          <div className="sm-day-head">
            <span className="label">
              {dayIdx === 0 && <span className="today">Today</span>}
              {dayLabels[dayIdx]}
            </span>
            <span className="count">8 classes</span>
          </div>
          <RowList>
            {Array.from({ length: 8 }).map((_, classIdx) => (
              <Row
                key={classIdx}
                lead={times[classIdx]}
                title={classNames[(dayIdx + classIdx) % classNames.length]}
                titleSuffix={<CategoryChip>{levels[(dayIdx + classIdx) % 3]}</CategoryChip>}
                meta={`${instructors[classIdx % 3]} · Studio · ${durations[classIdx % 3]} min`}
                trail={
                  <>
                    <Count value={`${booked[classIdx]} / ${capacities[classIdx]}`} tone={booked[classIdx] >= capacities[classIdx] ? "warn" : "default"} />
                    <StateBadge tone={booked[classIdx] >= capacities[classIdx] ? "warn" : "good"}>
                      {booked[classIdx] >= capacities[classIdx] ? "Full" : "Confirmed"}
                    </StateBadge>
                    <OverflowMenu items={[{ id: "edit", label: "Edit class" }]} onAction={() => {}} />
                  </>
                }
                onSelect={() => {}}
              />
            ))}
          </RowList>
        </div>
      ))}
    </Shell>
  );
}

const dayLabels = ["Sun · 4 May", "Mon · 5 May", "Tue · 6 May", "Wed · 7 May"];
const times = ["07:30", "09:00", "11:30", "12:00", "14:00", "17:00", "18:00", "19:30"];
const classNames = ["Mysore", "Bootylicious", "Reformer Flow", "Slow Yin", "Sunrise Flow", "Lunch Pilates", "Power Hour", "Restore"];
const levels = ["Beginner", "Open", "All levels"];
const instructors = ["Mira Holm", "Brikela", "Tor Lien"];
const durations = [60, 50, 90];
const booked = [8, 17, 6, 4, 9, 2, 14, 6];
const capacities = [12, 20, 6, 14, 14, 16, 20, 12];
