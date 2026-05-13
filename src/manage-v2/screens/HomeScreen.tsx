import { useState, useMemo } from "react";
import { Kpi } from "../components/Kpi";
import { StateBadge } from "../components/Badge";
import { PageHeader } from "../shell/PageHeader";
import { SectionHead } from "../shell/SectionHead";
import { useHomeDashboard, type Period } from "@/manage/hooks/useHomeDashboard";
import { useStudioContext } from "@/context/StudioContext";

// ── HomeScreen ─────────────────────────────────────────────────────
// 4 KPIs · Unmet demand (conditional) · Booking trend · Traffic
//
// Class fill rate is intentionally omitted: useHomeDashboard.fillRate
// returns a single percentage today; the design calls for a per-class
// ranked list (worst-first). Tracked as a follow-up enhancement.

export function HomeScreen() {
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";
  const [period, setPeriod] = useState<Period>("week");
  const dash = useHomeDashboard(period);

  return (
    <>
      <Greeting period={period} setPeriod={setPeriod} periodStart={dash.periodStart} />

      <Kpis period={period} dash={dash} currency={currency} />

      {dash.unmet.total > 0 && <UnmetDemand total={dash.unmet.total} bottleneckName={dash.unmet.bottleneckName} />}

      <BookingTrend spark={dash.spark} period={period} loading={dash.isLoading} />

      <Traffic data={dash.analytics} loading={dash.analyticsLoading} period={period} spark={dash.spark} />
    </>
  );
}

// ── Greeting + period toggle ───────────────────────────────────────
function Greeting({
  period,
  setPeriod,
  periodStart,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  periodStart: Date;
}) {
  const periodLabel = (() => {
    if (period === "day") return `Today · ${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    if (period === "week") return `Week commencing ${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    if (period === "month") return periodStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return `Year to date · ${periodStart.getFullYear()}`;
  })();

  return (
    <PageHeader
      title="Home"
      subtitle={periodLabel}
      actions={
        <div className="sm-segments" style={{ marginBottom: 0 }}>
          {(["day", "week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`sm-segment${period === p ? " on" : ""}`}
              onClick={() => setPeriod(p)}
            >
              <span className="sm:hidden">{p[0].toUpperCase()}</span>
              <span className="max-sm:hidden">{p[0].toUpperCase() + p.slice(1)}</span>
            </button>
          ))}
        </div>
      }
    />
  );
}

// ── KPI tiles 2x2 ──────────────────────────────────────────────────
function Kpis({
  period,
  dash,
  currency,
}: {
  period: Period;
  dash: ReturnType<typeof useHomeDashboard>;
  currency: string;
}) {
  const periodLabel = period === "day" ? "Yesterday" : period === "week" ? "Last week" : period === "month" ? "Last month" : "Last year";

  const bookingsCur = dash.bookings?.current ?? 0;
  const bookingsPrior = dash.bookings?.prior ?? 0;
  const bookingsPriorFull = dash.bookings?.priorFull ?? 0;
  const bookingsDelta = pctDelta(bookingsCur, bookingsPrior);

  const cashCur = dash.cash?.current ?? 0;
  const cashPrior = dash.cash?.prior ?? 0;
  const cashPriorFull = dash.cash?.priorFull ?? 0;
  const cashDelta = pctDelta(cashCur, cashPrior);

  const net = dash.members?.net ?? 0;
  const added = dash.members?.added ?? 0;
  const churned = dash.members?.churned ?? 0;

  return (
    <div className="sm-kpis" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
      <Kpi
        label="Bookings"
        value={fmt(bookingsCur)}
        delta={bookingsDelta?.label}
        trend={bookingsDelta?.trend}
        sub={`${periodLabel}: ${fmt(bookingsPriorFull)}`}
      />
      <Kpi
        label="Cash in"
        value={fmt(Math.round(cashCur))}
        unit={currency}
        delta={cashDelta?.label}
        trend={cashDelta?.trend}
        sub={`${periodLabel}: ${currency} ${fmt(Math.round(cashPriorFull))}`}
      />
      <Kpi
        label="Active subscription value"
        value={fmt(Math.round(dash.mrr?.total ?? 0))}
        unit={currency}
        sub="Point-in-time · active subscriptions"
      />
      <Kpi
        label="Net members"
        value={(net >= 0 ? "+" : "") + net}
        sub={`+${added} joined · −${churned} churned`}
      />
    </div>
  );
}

function pctDelta(current: number, prior: number): { label: string; trend: "up" | "down" } | null {
  if (prior === 0) return current === 0 ? null : { label: "+∞", trend: "up" };
  const pct = ((current - prior) / prior) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    label: `${sign}${Math.round(pct)}%`,
    trend: pct >= 0 ? "up" : "down",
  };
}

// ── Unmet demand (conditional) ─────────────────────────────────────
function UnmetDemand({ total, bottleneckName }: { total: number; bottleneckName: string | null }) {
  return (
    <section className="sm-section">
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-card)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <StateBadge tone="warn">{total} unmet</StateBadge>
        <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>
          People wanted to book but couldn't get a spot
          {bottleneckName ? (
            <>
              {" — bottleneck: "}
              <strong style={{ color: "var(--ink)" }}>{bottleneckName}</strong>
            </>
          ) : null}
          .
        </span>
      </div>
    </section>
  );
}

// ── Booking trend (30 bars w/ hover tooltip) ───────────────────────
function BookingTrend({
  spark,
  period,
  loading,
}: {
  spark: { label: string; count: number }[];
  period: Period;
  loading?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...spark.map((s) => s.count), 1);
  const last = spark.length - 1;
  const skipMobile = Math.ceil(spark.length / 14);
  const trailLabel =
    period === "day" ? "30 days" :
    period === "week" ? "30 weeks" :
    period === "month" ? "30 months" : "5 years";

  return (
    <section className="sm-section">
      <SectionHead
        title="Booking trend"
        rightSlot={
          <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
            Trailing {trailLabel} · last bar = in progress
          </span>
        }
      />
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-card)",
          padding: "20px 24px 14px",
        }}
      >
        {loading && <Spinner height={168} />}
        <div
          style={{
            height: 140,
            display: loading ? "none" : "flex",
            alignItems: "flex-end",
            gap: 6,
            borderBottom: "1px solid var(--line-soft)",
            paddingBottom: 4,
            position: "relative",
          }}
          onMouseLeave={() => setHover(null)}
        >
          {spark.map((b, i) => {
            const isLast = i === last;
            const isHover = hover === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setHover(i)}
                style={{
                  flex: 1,
                  height: `${(b.count / max) * 100 || 1}%`,
                  background: isLast ? "hsl(2 48% 78%)" : "var(--action)",
                  borderRadius: "3px 3px 0 0",
                  opacity: isLast ? 0.7 : hover === null || isHover ? 1 : 0.45,
                  transition: "opacity 80ms ease",
                  cursor: "default",
                }}
              />
            );
          })}
          {hover !== null && (() => {
            const b = spark[hover];
            const pct = ((hover + 0.5) / spark.length) * 100;
            const onRight = pct > 70;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: onRight ? "auto" : `${pct}%`,
                  right: onRight ? `${100 - pct}%` : "auto",
                  transform: onRight ? "translateX(8px)" : "translateX(-50%)",
                  marginBottom: 8,
                  background: "var(--ink)",
                  color: "var(--surface)",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 2,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{b.label}</div>
                <div style={{ opacity: 0.85 }}>{b.count} bookings</div>
              </div>
            );
          })()}
        </div>
        <div
          style={{
            display: loading ? "none" : "flex",
            gap: 6,
            fontSize: 10.5,
            color: "var(--ink-muted)",
            marginTop: 5,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {spark.map((b, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "clip",
              }}
              className={i % skipMobile !== 0 ? "max-sm:invisible" : ""}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Traffic (sources chips + stacked area chart) ───────────────────

const SOURCE_COLORS: Record<string, string> = {
  Search: "hsl(210 60% 55%)",
  Maps: "hsl(196 38% 48%)",
  Instagram: "hsl(330 65% 60%)",
  Direct: "hsl(155 35% 45%)",
  Facebook: "hsl(220 50% 45%)",
  TikTok: "hsl(2 48% 60%)",
  Other: "hsl(20 10% 60%)",
};

const STACK_ORDER = ["Direct", "Search", "Maps", "Instagram", "Facebook", "TikTok", "Other"];

function colorFor(source: string): string {
  return SOURCE_COLORS[source] ?? "hsl(20 10% 60%)";
}

// Catmull-Rom to cubic bezier segments — returns C commands only, no leading M
function crSegments(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 2) return "";
  let d = "";
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function areaPath(topPts: [number, number][], bottomPts: [number, number][]): string {
  if (!topPts.length) return "";
  const rev = [...bottomPts].reverse();
  return (
    `M ${topPts[0][0].toFixed(1)} ${topPts[0][1].toFixed(1)}` +
    crSegments(topPts) +
    ` L ${rev[0][0].toFixed(1)} ${rev[0][1].toFixed(1)}` +
    crSegments(rev) +
    " Z"
  );
}

function linePath(pts: [number, number][]): string {
  if (!pts.length) return "";
  return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}` + crSegments(pts);
}

function Traffic({
  data,
  loading,
  period,
  spark,
}: {
  data: ReturnType<typeof useHomeDashboard>["analytics"];
  loading: boolean;
  period: Period;
  spark: { label: string; count: number }[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const conversionsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data?.dailyConversions ?? []) map.set(d.date, d.count);
    return map;
  }, [data]);

  const bars = useMemo(() => {
    const totalLookup = new Map<string, number>();
    for (const d of data?.dailyBreakdown ?? []) totalLookup.set(d.date, d.count);
    const bySourceLookup = new Map<string, Map<string, number>>();
    for (const d of data?.dailyBySource ?? []) {
      if (!bySourceLookup.has(d.date)) bySourceLookup.set(d.date, new Map());
      bySourceLookup.get(d.date)!.set(d.source, d.count);
    }

    const now = new Date();
    type Bar = { key: string; label: string; sublabel: string; total: number; sourceCounts: Map<string, number> };
    const result: Bar[] = [];

    if (period === "day") {
      let prevMonth = "";
      for (let ago = 29; ago >= 0; ago--) {
        const d = new Date(now); d.setDate(d.getDate() - ago); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        const monthShort = d.toLocaleDateString("en-GB", { month: "short" });
        result.push({ key, label: String(d.getDate()), sublabel: monthShort !== prevMonth ? monthShort : "", total: totalLookup.get(key) ?? 0, sourceCounts: bySourceLookup.get(key) ?? new Map() });
        prevMonth = monthShort;
      }
    } else if (period === "week") {
      for (let i = 29; i >= 0; i--) {
        const day = now.getDay();
        const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7) - i * 7); monday.setHours(0, 0, 0, 0);
        const key = monday.toISOString().slice(0, 10);
        result.push({ key, label: monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), sublabel: "", total: totalLookup.get(key) ?? 0, sourceCounts: bySourceLookup.get(key) ?? new Map() });
      }
    } else if (period === "month") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 10);
        const yr = d.getFullYear() !== now.getFullYear() && d.getMonth() === 0 ? String(d.getFullYear()) : "";
        result.push({ key, label: d.toLocaleDateString("en-GB", { month: "short" }), sublabel: yr, total: totalLookup.get(key) ?? 0, sourceCounts: bySourceLookup.get(key) ?? new Map() });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const yr = now.getFullYear() - i;
        const key = `${yr}-01-01`;
        result.push({ key, label: String(yr), sublabel: "", total: totalLookup.get(key) ?? 0, sourceCounts: bySourceLookup.get(key) ?? new Map() });
      }
    }
    return result;
  }, [data, period]);

  const n = bars.length;
  const SVG_W = 600, SVG_H = 100;

  const activeSources = useMemo(
    () => STACK_ORDER.filter((src) => bars.some((b) => (b.sourceCounts.get(src) ?? 0) > 0)),
    [bars]
  );

  const stackData = useMemo(() => {
    if (n === 0) return [];
    const maxVal = Math.max(
      ...bars.map((b) => activeSources.reduce((s, src) => s + (b.sourceCounts.get(src) ?? 0), 0)),
      ...bars.map((b) => b.total),
      1
    );
    const xOf = (i: number) => ((i + 0.5) / n) * SVG_W;
    const yOf = (v: number) => SVG_H - (v / maxVal) * (SVG_H - 4);

    if (!activeSources.length) {
      const pts = bars.map((b, i) => [xOf(i), yOf(b.total)] as [number, number]);
      const base = bars.map((_b, i) => [xOf(i), SVG_H] as [number, number]);
      return [{ source: "Direct", topPoints: pts, bottomPoints: base }];
    }

    return activeSources.map((src, sIdx) => ({
      source: src,
      topPoints: bars.map((b, i) => {
        const v = activeSources.slice(0, sIdx + 1).reduce((s, s2) => s + (b.sourceCounts.get(s2) ?? 0), 0);
        return [xOf(i), yOf(v)] as [number, number];
      }),
      bottomPoints: bars.map((b, i) => {
        const v = activeSources.slice(0, sIdx).reduce((s, s2) => s + (b.sourceCounts.get(s2) ?? 0), 0);
        return [xOf(i), yOf(v)] as [number, number];
      }),
    }));
  }, [activeSources, bars, n]);

  const grandTotal = data?.visitors ?? 0;
  const sources = data?.sources ?? [];
  const sourceConvRateMap = useMemo(
    () => new Map((data?.sources ?? []).map((s) => [s.name, s.convRate])),
    [data]
  );
  const windowLabel = (
    { day: "last 30 days", week: "last 30 weeks", month: "last 30 months", year: "last 5 years" } as Record<Period, string>
  )[period];
  const skipMobile = Math.ceil(n / 14);
  const hoverLineX = hoverIdx !== null ? ((hoverIdx + 0.5) / n) * SVG_W : null;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.min(n - 1, Math.max(0, Math.floor((x / rect.width) * n)));
    setHoverIdx(idx);
  }

  return (
    <section className="sm-section">
      <SectionHead
        title={`Traffic · ${windowLabel}`}
        rightSlot={
          <span style={{ fontSize: 11.5, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
            {grandTotal.toLocaleString()} visitor{grandTotal === 1 ? "" : "s"}
          </span>
        }
      />
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-card)",
          padding: "18px 22px 16px",
        }}
      >
        {loading && <Spinner height={140} />}

        {!loading && (!data || data.noData) && (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>
            No traffic data yet — check back after visitors arrive on the site.
          </p>
        )}

        {!loading && data && !data.noData && (
          <>
            {/* Source chips */}
            {sources.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {sources.map((s) => (
                  <div
                    key={s.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px 6px 8px",
                      background: "var(--surface-2)",
                      borderRadius: 6,
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(s.name), display: "inline-block" }} />
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{s.visits.toLocaleString()}</span>
                    {s.convRate > 0 && (
                      <>
                        <span style={{ color: "var(--ink-faint)" }}>·</span>
                        <span style={{ color: "var(--ink-soft)" }}>{s.convRate}% conv</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stacked area chart */}
            <div
              style={{ position: "relative" }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <svg
                width="100%"
                height="120"
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                preserveAspectRatio="none"
                style={{ display: "block", overflow: "visible" }}
              >
                <defs>
                  {stackData.map(({ source }) => {
                    const id = `grad-${source.toLowerCase().replace(/[^a-z]/g, "")}`;
                    const c = colorFor(source);
                    return (
                      <linearGradient key={source} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity="0.75" />
                        <stop offset="100%" stopColor={c} stopOpacity="0.12" />
                      </linearGradient>
                    );
                  })}
                </defs>

                {/* Area fills — drawn bottom to top so upper layers paint over lower */}
                {stackData.map(({ source, topPoints, bottomPoints }) => (
                  <path
                    key={`area-${source}`}
                    d={areaPath(topPoints, bottomPoints)}
                    fill={`url(#grad-${source.toLowerCase().replace(/[^a-z]/g, "")})`}
                  />
                ))}

                {/* Stroke lines at the top edge of each area */}
                {stackData.map(({ source, topPoints }) => (
                  <path
                    key={`line-${source}`}
                    d={linePath(topPoints)}
                    fill="none"
                    stroke={colorFor(source)}
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}

                {/* Data point dots */}
                {stackData.map(({ source, topPoints }) =>
                  topPoints.map(([cx, cy], i) => {
                    if ((bars[i].sourceCounts.get(source) ?? 0) === 0) return null;
                    return (
                      <circle
                        key={`dot-${source}-${i}`}
                        cx={cx.toFixed(1)}
                        cy={cy.toFixed(1)}
                        r={hoverIdx === i ? 2.5 : 1.5}
                        fill={colorFor(source)}
                      />
                    );
                  })
                )}

                {/* Hover vertical rule */}
                {hoverLineX !== null && (
                  <line
                    x1={hoverLineX.toFixed(1)} y1="-2"
                    x2={hoverLineX.toFixed(1)} y2={SVG_H}
                    stroke="var(--ink-soft)" strokeWidth="0.8" strokeDasharray="3,3"
                  />
                )}
              </svg>

              {/* All-series hover tooltip */}
              {hoverIdx !== null && (() => {
                const bar = bars[hoverIdx];
                const srcCounts = activeSources
                  .map((src) => ({
                    src,
                    count: bar.sourceCounts.get(src) ?? 0,
                    convRate: sourceConvRateMap.get(src) ?? 0,
                  }))
                  .filter((x) => x.count > 0)
                  .sort((a, b) => b.count - a.count);
                const total = srcCounts.reduce((s, x) => s + x.count, 0) || bar.total;
                const convs = conversionsByDate.get(bar.key) ?? 0;
                const convRate = total > 0 ? ((convs / total) * 100).toFixed(1) : "0.0";
                const bookings = spark[hoverIdx]?.count ?? 0;
                const pct = n <= 1 ? 50 : (hoverIdx / (n - 1)) * 100;
                const onRight = pct > 68;
                return (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 10px)",
                      left: onRight ? "auto" : `${pct}%`,
                      right: onRight ? `${100 - pct}%` : "auto",
                      transform: onRight ? "translateX(10px)" : "translateX(-50%)",
                      background: "var(--ink)",
                      color: "var(--surface)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                      zIndex: 10,
                      minWidth: 150,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 7, fontSize: 12.5 }}>
                      {bar.label}{bar.sublabel ? ` ${bar.sublabel}` : ""}
                    </div>
                    {srcCounts.map(({ src, count, convRate }) => (
                      <div key={src} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: colorFor(src), flexShrink: 0, display: "inline-block" }} />
                        <span style={{ flex: 1, opacity: 0.85 }}>{src}</span>
                        <span style={{ marginLeft: 6 }}>{count}</span>
                        <span style={{ opacity: 0.5, fontSize: 11, minWidth: 34, textAlign: "right" }}>
                          {convRate > 0 ? `${convRate}%` : ""}
                        </span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 7, paddingTop: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
                        <span style={{ opacity: 0.65 }}>Visitors</span><span>{total}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
                        <span style={{ opacity: 0.65 }}>Bookings</span><span>{bookings}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                        <span style={{ opacity: 0.65 }}>Conv. rate</span><span>{convRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* X-axis labels — thinned on mobile */}
              <div
                style={{
                  display: "flex",
                  marginTop: 4,
                  fontSize: 10,
                  color: "var(--ink-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {bars.map((d, i) => (
                  <div
                    key={i}
                    style={{ flex: 1, textAlign: "center", overflow: "hidden" }}
                    className={i % skipMobile !== 0 ? "max-sm:invisible" : ""}
                  >
                    {d.label}
                  </div>
                ))}
              </div>
              {bars.some((d) => d.sublabel) && (
                <div
                  style={{
                    display: "flex",
                    marginTop: 1,
                    fontSize: 10,
                    color: "var(--ink-soft)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {bars.map((d, i) => (
                    <div
                      key={i}
                      style={{ flex: 1, textAlign: "center", overflow: "hidden", fontWeight: d.sublabel ? 500 : 400 }}
                    >
                      {d.sublabel}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Spinner({ height = 120 }: { height?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height }}>
      <div
        className="animate-spin"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "2px solid var(--line)",
          borderTopColor: "var(--ink-muted)",
        }}
      />
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US").replace(/,/g, " ");
}
