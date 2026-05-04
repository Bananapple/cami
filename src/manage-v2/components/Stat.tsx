type Tone = "default" | "warn";

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: Tone;
}) {
  return (
    <div className="sm-stat">
      <div className="lab">{label}</div>
      <div className={"v" + (tone === "warn" ? " warn" : "")}>{value}</div>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="sm-stats">{children}</div>;
}
