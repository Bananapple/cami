import { useState } from "react";
import "../tokens/tokens.css";
import { Button } from "../components/Button";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { Kpi } from "../components/Kpi";
import { Row, RowList } from "../components/Row";
import { OverflowMenu } from "../components/OverflowMenu";
import { EmptyState } from "../components/EmptyState";
import { Stat, StatGrid } from "../components/Stat";
import { Drawer, DrawerSection, EditLink } from "../components/Drawer";

export function PrimitivesPreview() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("attending");

  return (
    <div className="sm-app" style={{ minHeight: "100vh", padding: 48, position: "relative" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.018em", margin: "0 0 32px" }}>
          /manage v2 — Primitives preview
        </h1>

        <Section title="Buttons">
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </Row>
          <Row>
            <Button variant="primary" size="sm">Primary sm</Button>
            <Button variant="secondary" size="sm">Secondary sm</Button>
            <Button variant="ghost" size="sm">Ghost sm</Button>
            <Button variant="danger" size="sm">Danger sm</Button>
          </Row>
          <Row>
            <Button variant="primary" loading>Saving</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </Row>
        </Section>

        <Section title="StateBadge">
          <Row>
            <StateBadge tone="good">Active</StateBadge>
            <StateBadge tone="warn">Low credits</StateBadge>
            <StateBadge tone="bad">Lapsed</StateBadge>
            <StateBadge tone="info">Expiring</StateBadge>
            <StateBadge tone="neutral">No plan</StateBadge>
          </Row>
        </Section>

        <Section title="CategoryChip (level)">
          <Row>
            <CategoryChip>Beginner</CategoryChip>
            <CategoryChip>Open</CategoryChip>
            <CategoryChip>All levels</CategoryChip>
          </Row>
        </Section>

        <Section title="Count">
          <Row>
            <Count value="8 / 12" label="booked" />
            <Count value={3} label="left" tone="warn" />
            <Count value={0} label="left" tone="danger" />
            <Count value={47} label="visits" />
          </Row>
        </Section>

        <Section title="Kpi">
          <div className="sm-kpis">
            <Kpi label="Bookings" value={42} delta="+18%" trend="up" sub="Last week: 36" />
            <Kpi label="Cash in" value="3 240" unit="kr" delta="+22%" trend="up" sub="Last week: 2 660 kr" />
            <Kpi label="Active subs" value="8 400" unit="kr" sub="No change" />
            <Kpi label="Net members" value="+4" trend="up" delta="+2" sub="Last week: +2" />
          </div>
        </Section>

        <Section title="Row + RowList — schedule example">
          <RowList>
            <Row
              lead="09:00"
              title="Mysore"
              titleSuffix={<CategoryChip>Open</CategoryChip>}
              meta="Mira Holm · Studio · 90 min"
              trail={
                <>
                  <Count value="8 / 12" />
                  <StateBadge tone="good">Confirmed</StateBadge>
                  <OverflowMenu
                    items={[
                      { id: "edit", label: "Edit class", group: 1 },
                      { id: "sub", label: "Sub instructor", group: 1 },
                      { id: "cancel", label: "Cancel class", group: 3, danger: true, dialog: true },
                    ]}
                    onAction={(id) => alert("Action: " + id)}
                  />
                </>
              }
              onSelect={() => alert("open class drawer")}
            />
            <Row
              lead="11:30"
              title="Bootylicious"
              titleSuffix={<CategoryChip>All levels</CategoryChip>}
              meta="Brikela · Studio · 50 min"
              trail={
                <>
                  <Count value="17 / 20" />
                  <StateBadge tone="good">Confirmed</StateBadge>
                  <OverflowMenu items={[{ id: "edit", label: "Edit class" }]} onAction={() => {}} />
                </>
              }
              selected
              onSelect={() => {}}
            />
            <Row
              lead="14:00"
              title="Reformer Flow"
              titleSuffix={<CategoryChip>Beginner</CategoryChip>}
              meta="Brikela · Reformer · 50 min"
              trail={
                <>
                  <Count value="6 / 6" tone="warn" />
                  <StateBadge tone="warn">Full · 2 wait</StateBadge>
                  <OverflowMenu items={[{ id: "edit", label: "Edit class" }]} onAction={() => {}} />
                </>
              }
              onSelect={() => {}}
            />
          </RowList>
        </Section>

        <Section title="Row — clients example (avatar lead)">
          <RowList>
            <Row
              lead={<span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>NV</span>}
              title="Nico Vibe"
              meta="nico@example.com · last visit 3 days ago"
              trail={
                <>
                  <Count value={47} label="visits" />
                  <StateBadge tone="good">Active · All Inclusive</StateBadge>
                </>
              }
              onSelect={() => {}}
            />
            <Row
              lead={<span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>FK</span>}
              title="Frida Kalo"
              meta="frida@example.com · 10-clip · 3 left"
              trail={
                <>
                  <Count value={12} label="visits" />
                  <StateBadge tone="warn">Low credits</StateBadge>
                </>
              }
              onSelect={() => {}}
            />
          </RowList>
        </Section>

        <Section title="EmptyState">
          <RowList>
            <EmptyState
              title="No clients in this segment"
              hint="Lapsed members reappear here when they go 60 days without a visit."
            />
          </RowList>
        </Section>

        <Section title="Stat grid (4-up)">
          <StatGrid>
            <Stat label="This month" value={12} />
            <Stat label="Year to date" value={97} />
            <Stat label="No-shows" value={2} tone="warn" />
            <Stat label="Total spent" value="6 250 kr" />
          </StatGrid>
        </Section>

        <Section title="Drawer">
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
            Open Bootylicious drawer
          </Button>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
            Verifies: sticky header + tabs, sticky section eyebrows, sticky action bar,
            single body scroll, tab switch resets scroll, esc closes.
          </p>
        </Section>

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Bootylicious"
          subtitle="Sun 4 May · 11:30 — 12:20 · Brikela · Studio"
          headerMeta={
            <>
              <StateBadge tone="good">Scheduled</StateBadge>
              <CategoryChip>All levels</CategoryChip>
              <Count value="17 / 20" label="booked" />
            </>
          }
          tabs={[
            { id: "attending", label: "Attending", count: 17 },
            { id: "waitlist", label: "Waitlist", count: 3 },
            { id: "cancelled", label: "Cancelled", count: 2 },
            { id: "details", label: "Details" },
          ]}
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          actions={
            <>
              <Button variant="danger" style={{ marginRight: "auto" }}>Cancel class</Button>
              <Button variant="ghost">Sub instructor</Button>
              <Button variant="primary">Edit class</Button>
            </>
          }
        >
          {drawerTab === "attending" && (
            <>
              <DrawerSection title="Notes" action={<EditLink>Edit</EditLink>}>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
                  Bring extra mats — heavier crowd than usual.
                </p>
              </DrawerSection>
              <DrawerSection
                title={`Attending · 17`}
                action={<EditLink>Add walk-in</EditLink>}
                flush
              >
                {Array.from({ length: 17 }, (_, i) => (
                  <Row
                    key={i}
                    lead={
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>
                        {String.fromCharCode(65 + (i % 26))}{String.fromCharCode(65 + ((i * 7) % 26))}
                      </span>
                    }
                    title={`Member ${i + 1}`}
                    meta={i === 2 ? "Drop-in · first visit" : "All Inclusive · 8 visits"}
                    trail={
                      <>
                        <StateBadge tone="good">Paid</StateBadge>
                        <OverflowMenu items={[{ id: "remove", label: "Remove", danger: true }]} onAction={() => {}} />
                      </>
                    }
                    onSelect={() => {}}
                  />
                ))}
              </DrawerSection>
            </>
          )}

          {drawerTab === "waitlist" && (
            <DrawerSection title="Waitlist · 3" flush>
              <Row lead={<span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>AS</span>} title="Anja Storm" meta="Offered 11m ago" trail={<StateBadge tone="warn">Offered · 11m</StateBadge>} onSelect={() => {}} />
              <Row lead={<span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>BH</span>} title="Ben Hauge" meta="In line · #2" trail={<StateBadge tone="neutral">Waiting</StateBadge>} onSelect={() => {}} />
              <Row lead={<span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>CP</span>} title="Cleo Park" meta="In line · #3" trail={<StateBadge tone="neutral">Waiting</StateBadge>} onSelect={() => {}} />
            </DrawerSection>
          )}

          {drawerTab === "cancelled" && (
            <EmptyState
              title="2 clients cancelled in advance"
              hint="Spots auto-released to the waitlist."
            />
          )}

          {drawerTab === "details" && (
            <DrawerSection title="Class details">
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
                50 min · All levels · kr 250 drop-in
              </p>
            </DrawerSection>
          )}
        </Drawer>

        <Section title="Field">
          <div style={{ maxWidth: 480 }}>
            <Field label="Class name" help="Shown to members on the schedule">
              <input style={inputStyle} placeholder="Gentle Flow" />
            </Field>
            <div style={{ height: 16 }} />
            <Field label="Capacity" error="Must be at least 1">
              <input style={inputStyle} type="number" defaultValue={0} />
            </Field>
            <div style={{ height: 16 }} />
            <FieldRow>
              <Field label="Duration (min)">
                <input style={inputStyle} type="number" defaultValue={60} />
              </Field>
              <Field label="Price (kr)">
                <input style={inputStyle} type="number" defaultValue={250} />
              </Field>
            </FieldRow>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink-muted)",
          fontWeight: 600,
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>;
}
