import { useState, useMemo } from "react";
import { Kpi } from "../components/Kpi";
import { StateBadge } from "../components/Badge";
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

      <BookingTrend spark={dash.spark} period={period} />

      <Traffic data={dash.analytics} loading={dash.analyticsLoading} />
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
    if (period === "week") {
      const end = new Date(periodStart);
      end.setDate(end.getDate() + 6);
      return `Week commencing ${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
    if (period === "month") return periodStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return `Year to date · ${periodStart.getFullYear()}`;
  })();

  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
      <div className="sm-greeting">
        <h1>Home</h1>
        <p className="sub">{periodLabel}</p>
      </div>
      <div className="sm-segments" style={{ marginBottom: 0 }}>
        {(["week", "month", "year"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            className={"sm-segment " + (period === p ? "on" : "")}
            onClick={() => setPeriod(p)}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
    </div>
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
  const periodLabel = period === "week" ? "Last week" : period === "month" ? "Last month" : "Last year";

  // Bookings delta vs same elapsed-into-prior period
  const bookingsCur = dash.bookings?.current ?? 0;
  const bookingsPrior = dash.bookings?.prior ?? 0;
  const bookingsPriorFull = dash.bookings?.priorFull ?? 0;
  const bookingsDelta = pctDelta(bookingsCur, bookingsPrior);

  // Cash
  const cashCur = dash.cash?.current ?? 0;
  const cashPrior = dash.cash?.prior ?? 0;
  const cashPriorFull = dash.cash?.priorFull ?? 0;
  const cashDelta = pctDelta(cashCur, cashPrior);

  // Members
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

// ── Booking trend (12 bars w/ hover tooltip) ───────────────────────
function BookingTrend({
  spark,
  period,
}: {
  spark: { label: string; count: number }[];
  period: Period;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...spark.map((s) => s.count), 1);
  const last = spark.length - 1;

  return (
    <section className="sm-section">
      <div className="sm-section-head">
        <h2>Booking trend</h2>
        <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
          Trailing 12 {period === "week" ? "weeks" : period === "month" ? "months" : "years"} · last bar = in progress
        </span>
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-card)",
          padding: "20px 24px 14px",
        }}
      >
        <div
          style={{
            height: 140,
            display: "flex",
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
            display: "flex",
            gap: 6,
            fontSize: 11,
            color: "var(--ink-muted)",
            marginTop: 6,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {spark.map((b, i) => {
            const stride = spark.length >= 12 ? 3 : 2;
            const isLast = i === last;
            const showThis = i === 0 || isLast || i % stride === 0;
            return (
              <span
                key={i}
                style={{
                  flex: 1,
                  textAlign: i === 0 ? "left" : isLast ? "right" : "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {showThis ? b.label : ""}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Traffic (sources chips + 30-day stacked bars) ──────────────────

const SOURCE_COLORS: Record<string, string> = {
  Google: "hsl(210 60% 55%)",
  Search: "hsl(210 60% 55%)",
  Maps: "hsl(155 35% 45%)",
  Instagram: "hsl(330 65% 60%)",
  Direct: "hsl(155 35% 45%)",
  Facebook: "hsl(220 50% 45%)",
  TikTok: "hsl(2 48% 60%)",
  Other: "hsl(20 10% 60%)",
};

function colorFor(source: string): string {
  return SOURCE_COLORS[source] ?? "hsl(20 10% 60%)";
}

function Traffic({
  data,
  loading,
}: {
  data: ReturnType<typeof useHomeDashboard>["analytics"];
  loading: boolean;
}) {
  // Pre-compute a normalized 30-day series with totals per day
  const days = useMemo(() => {
    if (!data?.dailyBreakdown?.length) return [];
    return data.dailyBreakdown.map((d) => ({ date: d.date, total: d.count }));
  }, [data]);

  const max = Math.max(...days.map((d) => d.total), 1);
  const grandTotal = data?.visitors ?? 0;
  const sources = data?.sources ?? [];

  return (
    <section className="sm-section">
      <div className="sm-section-head">
        <h2>Traffic · last 30 days</h2>
        <span style={{ fontSize: 11.5, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
          {grandTotal.toLocaleString()} visitor{grandTotal === 1 ? "" : "s"}
        </span>
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-card)",
          padding: "18px 22px 16px",
        }}
      >
        {loading && (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>Loading traffic data…</p>
        )}

        {!loading && (!data || data.noData) && (
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>
            No traffic data yet — check back after visitors arrive on the site.
          </p>
        )}

        {!loading && data && !data.noData && (
          <>
            {/* Source chips with conversion rate */}
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
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: colorFor(s.name),
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{s.visits.toLocaleString()}</span>
                    <span style={{ color: "var(--ink-faint)" }}>·</span>
                    <span style={{ color: "var(--ink-soft)" }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* 30-day bar chart — total visits per day (the source breakdown
                 per day isn't returned by get-analytics today, so bars are
                 single-color rather than stacked. Switch to stacked once
                 the function returns daily-by-source). */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  height: 120,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 3,
                  borderBottom: "1px solid var(--line-soft)",
                  paddingBottom: 2,
                }}
              >
                {days.map((d, i) => (
                  <div
                    key={i}
                    title={`${d.date}: ${d.total} visitor${d.total === 1 ? "" : "s"}`}
                    style={{
                      flex: 1,
                      height: `${(d.total / max) * 100 || 1}%`,
                      background: "var(--action)",
                      opacity: 0.65,
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--ink-muted)",
                  marginTop: 6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US").replace(/,/g, " ");
}
