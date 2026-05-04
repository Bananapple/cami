import "../tokens/tokens.css";
import { Button } from "../components/Button";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { Kpi } from "../components/Kpi";

export function PrimitivesPreview() {
  return (
    <div className="sm-app" style={{ minHeight: "100vh", padding: 48 }}>
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
