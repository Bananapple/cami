import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useHomeDashboard, type Period, type SparkPoint } from "../hooks/useHomeDashboard";
import { useStudioContext } from "@/context/StudioContext";

// ── Period toggle ────────────────────────────────────────────────────────────

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: { label: string; value: Period }[] = [
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function pct(current: number, prior: number): number | null {
  if (!prior) return null;
  return Math.round(((current - prior) / prior) * 100);
}

function KpiTile({
  label,
  value,
  current,
  prior,
  priorFull,
  priorLabel,
  loading,
}: {
  label: string;
  value: string;
  current: number;
  prior: number;
  priorFull: number;
  priorLabel: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="border border-border rounded-xl p-5 space-y-2">
        <div className="h-3 w-20 bg-muted/50 rounded animate-pulse" />
        <div className="h-7 w-28 bg-muted/50 rounded animate-pulse" />
        <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  const change = pct(current, prior);
  const isUp = change !== null && change > 0;
  const isDown = change !== null && change < 0;

  return (
    <div className="border border-border rounded-xl p-5 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-serif">{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {change !== null ? (
          <span className={`flex items-center gap-0.5 text-sm font-medium ${isUp ? "text-green-600" : isDown ? "text-red-500" : "text-muted-foreground"}`}>
            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : isDown ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {change > 0 ? "+" : ""}{change}%
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
        <span className="text-xs text-muted-foreground">{priorLabel}: {priorFull}</span>
      </div>
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: SparkPoint[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 400;
  const h = 60;
  const barW = Math.floor(w / data.length) - 2;

  return (
    <div className="border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Booking trend</p>
        <span className="text-[10px] text-muted-foreground/60">last bar = in progress</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = max > 0 ? (d.count / max) * h : 0;
          const x = i * (w / data.length);
          const isCurrent = i === data.length - 1;
          return (
            <rect
              key={i}
              x={x + 1}
              y={h - barH}
              width={barW}
              height={barH}
              className={isCurrent ? "fill-primary/25" : "fill-primary/60"}
              rx="2"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// ── Fill rate bar ─────────────────────────────────────────────────────────────

function FillRateBar({ pct, loading }: { pct: number | null; loading: boolean }) {
  return (
    <div className="border border-border rounded-xl p-5 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Class fill rate</p>
      {loading ? (
        <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
      ) : pct === null ? (
        <p className="text-sm text-muted-foreground">No classes this period</p>
      ) : (
        <>
          <p className="text-2xl font-serif">{pct}%</p>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Unmet demand ──────────────────────────────────────────────────────────────

function UnmetDemandPanel({ total, bottleneckName, loading }: { total: number; bottleneckName: string | null; loading: boolean }) {
  return (
    <div className="border border-border rounded-xl p-5 space-y-2 col-span-full">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unmet demand</p>
      {loading ? (
        <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">No unmet demand this period — all waitlisted students got a spot.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold">{total}</span> student{total !== 1 ? "s" : ""} couldn't get a spot this period.
            {bottleneckName && (
              <> Biggest bottleneck: <span className="font-medium">{bottleneckName}</span>.</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Consider adding another slot for {bottleneckName ?? "this class"}.</p>
        </div>
      )}
    </div>
  );
}

// ── Daily traffic chart (bars = visitors, line = conversion rate) ──────────────

function DailyTrafficChart({
  visitors,
  conversions,
}: {
  visitors: { date: string; count: number }[];
  conversions: { date: string; count: number }[];
}) {
  const w = 400;
  const h = 60;
  const barW = Math.max(Math.floor(w / 30) - 1, 2);

  // Build aligned 30-day arrays
  const today = new Date();
  const visMap = Object.fromEntries(visitors.map((d) => [d.date, d.count]));
  const convMap = Object.fromEntries(conversions.map((d) => [d.date, d.count]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    const key = d.toISOString().slice(0, 10);
    return { v: visMap[key] ?? 0, c: convMap[key] ?? 0 };
  });

  const maxV = Math.max(...days.map((d) => d.v), 1);

  // Build conversion rate line path (only connect days with visitors)
  let linePath = "";
  days.forEach((d, i) => {
    if (d.v === 0) return;
    const rate = Math.min((d.c / d.v) * 100, 100);
    const x = i * (w / 30) + barW / 2;
    const y = h - (rate / 100) * h;
    linePath += linePath === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
      {days.map((d, i) => {
        const barH = (d.v / maxV) * h;
        const x = i * (w / 30);
        return (
          <rect key={i} x={x + 0.5} y={h - barH} width={barW} height={barH}
            className="fill-primary/40" rx="1" />
        );
      })}
      {linePath && (
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {days.map((d, i) => {
        if (d.v === 0) return null;
        const rate = Math.min((d.c / d.v) * 100, 100);
        const x = i * (w / 30) + barW / 2;
        const y = h - (rate / 100) * h;
        return <circle key={i} cx={x} cy={y} r="2" className="fill-primary" />;
      })}
    </svg>
  );
}

// ── Traffic panel ─────────────────────────────────────────────────────────────

function TrafficPanel({ data, loading }: { data: ReturnType<typeof useHomeDashboard>["analytics"]; loading: boolean }) {
  return (
    <div className="border border-border rounded-xl p-5 space-y-3 col-span-full">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Traffic (last 30 days)</p>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-40 bg-muted/50 rounded animate-pulse" />
          <div className="h-10 w-full bg-muted/50 rounded animate-pulse" />
        </div>
      ) : !data || data.noData ? (
        <p className="text-sm text-muted-foreground">No traffic data yet — check back after visitors arrive on the site.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-2xl font-serif">{data.avgPerDay ?? 0}</p>
              <p className="text-xs text-muted-foreground">avg visitors/day</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div>
              <p className="text-2xl font-serif">{data.conversions}</p>
              <p className="text-xs text-muted-foreground">bookings</p>
            </div>
            <div>
              <p className="text-2xl font-serif">{data.conversionRate}%</p>
              <p className="text-xs text-muted-foreground">conversion</p>
            </div>
          </div>
          <DailyTrafficChart visitors={data.dailyBreakdown ?? []} conversions={data.dailyConversions ?? []} />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
          {data.sources?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.sources.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1 text-xs bg-muted/50 rounded-full px-3 py-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{s.pct}%</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function periodLabel(period: Period, start: Date): string {
  if (period === "week") {
    return `Week commencing ${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }
  if (period === "month") {
    return start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  return String(start.getFullYear());
}

function priorLabel(period: Period): string {
  if (period === "week") return "Last week";
  if (period === "month") return "Last month";
  return "Last year";
}

export function HomeView() {
  const [period, setPeriod] = useState<Period>("week");
  const studioCtx = useStudioContext();
  const currency = studioCtx?.studio?.currency ?? "NOK";

  const {
    bookings,
    cash,
    mrr,
    members,
    spark,
    fillRate,
    unmet,
    analytics,
    analyticsLoading,
    periodStart,
    isLoading,
    error,
  } = useHomeDashboard(period);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-sm text-red-500">Failed to load dashboard data. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-serif">Home</h1>
      </header>

      <div className="space-y-1">
        <PeriodToggle value={period} onChange={setPeriod} />
        <p className="text-xs text-muted-foreground pl-1">{periodLabel(period, periodStart)}</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          label="Bookings"
          value={String(bookings?.current ?? 0)}
          current={bookings?.current ?? 0}
          prior={bookings?.prior ?? 0}
          priorFull={bookings?.priorFull ?? 0}
          priorLabel={priorLabel(period)}
          loading={isLoading}
        />
        <KpiTile
          label="Cash in"
          value={formatCurrency(cash?.current ?? 0, currency)}
          current={cash?.current ?? 0}
          prior={cash?.prior ?? 0}
          priorFull={cash?.priorFull ? formatCurrency(cash.priorFull, currency) as any : 0}
          priorLabel={priorLabel(period)}
          loading={isLoading}
        />
        <div className="border border-border rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active subscription value</p>
          {isLoading ? (
            <div className="h-7 w-28 bg-muted/50 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-serif">{formatCurrency(mrr?.total ?? 0, currency)}</p>
              <p className="text-xs text-muted-foreground">Point-in-time · active subscriptions</p>
            </>
          )}
        </div>
        <div className="border border-border rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net members</p>
          {isLoading ? (
            <div className="h-7 w-20 bg-muted/50 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-serif">
                {members?.net !== undefined && members.net >= 0 ? "+" : ""}{members?.net ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                +{members?.added ?? 0} joined · −{members?.churned ?? 0} churned
              </p>
            </>
          )}
        </div>
      </div>

      {/* Unmet demand */}
      <div className="grid grid-cols-1">
        <UnmetDemandPanel
          total={unmet.total}
          bottleneckName={unmet.bottleneckName}
          loading={isLoading}
        />
      </div>

      {/* Sparkline + Fill rate side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Sparkline data={spark} />
        </div>
        <div className="col-span-2">
          <FillRateBar pct={fillRate} loading={isLoading} />
        </div>
      </div>

      {/* Traffic */}
      <TrafficPanel data={analytics} loading={analyticsLoading} />
    </div>
  );
}
