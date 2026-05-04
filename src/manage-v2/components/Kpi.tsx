type Trend = "up" | "down";
type Tone = "default" | "warn" | "bad";

export function Kpi({
  label,
  value,
  unit,
  delta,
  trend,
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  unit?: string;
  delta?: string;
  trend?: Trend;
  sub: string;
  tone?: Tone;
}) {
  const valueCls = ["v", tone === "warn" ? "warn" : "", tone === "bad" ? "bad" : ""]
    .filter(Boolean)
    .join(" ");
  const deltaCls = ["delta", trend === "up" ? "up" : "", trend === "down" ? "down" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="sm-kpi">
      <div className="lab">{label}</div>
      <div className={valueCls}>
        {value}
        {unit && (
          <span style={{ fontSize: 14, color: "var(--ink-soft)", marginLeft: 4, fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
      {delta && <div className={deltaCls}>{delta}</div>}
      <div className="sub">{sub}</div>
    </div>
  );
}
