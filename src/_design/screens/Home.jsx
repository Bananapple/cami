// Home — analytics dashboard with period toggle
// Keeps the existing IA (Week/Month/Year + KPI tiles + charts), applies vocabulary

// ---------------- Class fill rate card -----------------
// Per-class ranked list, worst-first, with Past/Upcoming toggle.
// Row template: lead = day+time, body = class name + instructor, trail = fill bar + count.

const FILL_DATA = {
  week: {
    past: [
      { name: "Bootylicious",     instr: "Frida Kalo",     when: "Mon · 17:00", booked: 4,  cap: 20 },
      { name: "Morning flow",     instr: "Anna Berg",      when: "Wed · 07:00", booked: 6,  cap: 18 },
      { name: "Yin yoga",         instr: "Lena Holm",      when: "Sun · 19:00", booked: 9,  cap: 16 },
      { name: "Vinyasa",          instr: "Frida Kalo",     when: "Tue · 18:30", booked: 11, cap: 18 },
      { name: "Power hour",       instr: "Marcus Lind",    when: "Thu · 17:30", booked: 14, cap: 20 },
      { name: "Hatha basics",     instr: "Lena Holm",      when: "Fri · 09:00", booked: 13, cap: 16 },
      { name: "Restorative",      instr: "Anna Berg",      when: "Sat · 11:00", booked: 14, cap: 16 },
      { name: "Hot vinyasa",      instr: "Marcus Lind",    when: "Sat · 09:00", booked: 18, cap: 20 },
    ],
    upcoming: [
      { name: "Bootylicious",     instr: "Frida Kalo",     when: "Mon · 17:00", booked: 7,  cap: 20 },
      { name: "Morning flow",     instr: "Anna Berg",      when: "Wed · 07:00", booked: 8,  cap: 18 },
      { name: "Yin yoga",         instr: "Lena Holm",      when: "Sun · 19:00", booked: 10, cap: 16 },
      { name: "Vinyasa",          instr: "Frida Kalo",     when: "Tue · 18:30", booked: 13, cap: 18 },
      { name: "Hatha basics",     instr: "Lena Holm",      when: "Fri · 09:00", booked: 14, cap: 16 },
      { name: "Power hour",       instr: "Marcus Lind",    when: "Thu · 17:30", booked: 17, cap: 20 },
      { name: "Restorative",      instr: "Anna Berg",      when: "Sat · 11:00", booked: 15, cap: 16 },
      { name: "Hot vinyasa",      instr: "Marcus Lind",    when: "Sat · 09:00", booked: 20, cap: 20 },
    ],
  },
};

const FillRateCard = ({ period }) => {
  const [scope, setScope] = React.useState("past"); // past | upcoming
  const data = (FILL_DATA[period] || FILL_DATA.week)[scope];
  const sorted = [...data].sort((a, b) => (a.booked / a.cap) - (b.booked / b.cap));
  const total = data.reduce((acc, c) => ({ booked: acc.booked + c.booked, cap: acc.cap + c.cap }), { booked: 0, cap: 0 });
  const avgPct = Math.round((total.booked / total.cap) * 100);

  return (
    <div className="sm-section">
      <div className="sm-section-head">
        <h2>Class fill rate</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
            {avgPct}% avg · {total.booked}/{total.cap} spots
          </span>
          <div className="sm-segments" style={{ marginBottom: 0 }}>
            <button className={"sm-segment " + (scope === "past" ? "on" : "")} onClick={() => setScope("past")}>Past</button>
            <button className={"sm-segment " + (scope === "upcoming" ? "on" : "")} onClick={() => setScope("upcoming")}>Upcoming</button>
          </div>
        </div>
      </div>
      <div className="sm-list">
        {sorted.map((c, i) => {
          const pct = Math.round((c.booked / c.cap) * 100);
          const tone = pct < 50 ? "var(--bad)" : pct < 80 ? "var(--warn)" : "var(--good)";
          return (
            <div key={i} className="sm-row">
              <div className="sm-row-lead" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-soft)", fontSize: 12 }}>
                {c.when}
              </div>
              <div className="sm-row-body">
                <div className="sm-row-title">{c.name}</div>
                <div className="sm-row-meta">{c.instr}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 220 }}>
                <div style={{ flex: 1, height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: tone }}></div>
                </div>
                <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--ink-soft)", minWidth: 64, textAlign: "right" }}>
                  {c.booked}/{c.cap} · {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- Traffic card -----------------
// Stacked bars by source + per-source conversion chips. Sources: Google, Instagram, Direct, Facebook, TikTok.

const SOURCE_COLORS = {
  Google:    "hsl(210 60% 55%)",
  Instagram: "hsl(330 65% 60%)",
  Direct:    "hsl(155 35% 45%)",
  Facebook:  "hsl(220 50% 45%)",
  TikTok:    "hsl(2 48% 60%)",
};

const SOURCE_ORDER = ["Google", "Instagram", "Direct", "Facebook", "TikTok"];

const TRAFFIC = {
  conversions: { Google: 4.2, Instagram: 1.8, Direct: 6.1, Facebook: 0.9, TikTok: 2.4 },
  // 30 days of synthetic source visits — each entry: [G, I, D, F, T]
  daily: Array.from({ length: 30 }, (_, i) => {
    const wobble = (s) => 0.6 + 0.5 * Math.abs(Math.sin(i * s));
    return [
      Math.round(38 * wobble(0.7)),  // Google
      Math.round(62 * wobble(0.4)),  // Instagram
      Math.round(22 * wobble(1.1)),  // Direct
      Math.round(14 * wobble(0.9)),  // Facebook
      Math.round(28 * wobble(0.6)),  // TikTok
    ];
  }),
};

const TrafficCard = ({ period }) => {
  const data = TRAFFIC.daily;
  const max = Math.max(...data.map(d => d.reduce((a, b) => a + b, 0)));
  const totals = SOURCE_ORDER.map((_, idx) => data.reduce((sum, d) => sum + d[idx], 0));
  const grandTotal = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="sm-section">
      <div className="sm-section-head">
        <h2>Traffic · last 30 days</h2>
        <span style={{ fontSize: 11.5, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
          {grandTotal.toLocaleString()} visitors
        </span>
      </div>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        padding: "18px 22px 16px",
      }}>
        {/* Per-source conversion chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {SOURCE_ORDER.map((s, idx) => {
            const visitors = totals[idx];
            const conv = TRAFFIC.conversions[s];
            return (
              <div key={s} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px 6px 8px",
                background: "var(--surface-2)",
                borderRadius: 6,
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: SOURCE_COLORS[s], display: "inline-block" }}></span>
                <span style={{ fontWeight: 500 }}>{s}</span>
                <span style={{ color: "var(--ink-muted)" }}>{visitors.toLocaleString()}</span>
                <span style={{ color: "var(--ink-faint)" }}>·</span>
                <span style={{ color: "var(--ink-soft)" }}>{conv}% conv</span>
              </div>
            );
          })}
        </div>

        {/* Stacked bar chart */}
        <div style={{ position: "relative" }}>
          <div style={{
            height: 120,
            display: "flex", alignItems: "flex-end", gap: 3,
            borderBottom: "1px solid var(--line-soft)",
            paddingBottom: 2,
          }}>
            {data.map((day, i) => {
              const dayTotal = day.reduce((a, b) => a + b, 0);
              const colHeight = (dayTotal / max) * 100;
              return (
                <div key={i} style={{
                  flex: 1, height: `${colHeight}%`,
                  display: "flex", flexDirection: "column-reverse",
                  borderRadius: "2px 2px 0 0", overflow: "hidden",
                }}>
                  {SOURCE_ORDER.map((s, idx) => (
                    <div
                      key={s}
                      style={{
                        flex: day[idx],
                        background: SOURCE_COLORS[s],
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 11, color: "var(--ink-muted)",
            marginTop: 6, fontVariantNumeric: "tabular-nums",
          }}>
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const HomeScreen = () => {
  const [period, setPeriod] = React.useState("week");

  const kpis = {
    week: [
      { lab: "Bookings",                 v: "3",       delta: "-40%",  trend: "down", sub: "Last week: 5" },
      { lab: "Cash in",                  v: "8,500",   unit: "kr",     delta: "+125%", trend: "up",   sub: "Last week: 3,780 kr" },
      { lab: "Active subscription value", v: "1,600",  unit: "kr",     sub: "Point-in-time · active subscriptions" },
      { lab: "Net members",              v: "+4",                       sub: "+5 joined · −1 churned" },
    ],
    month: [
      { lab: "Bookings",                 v: "47",                       delta: "+18%", trend: "up",   sub: "Last month: 40" },
      { lab: "Cash in",                  v: "32,400", unit: "kr",       delta: "+22%", trend: "up",   sub: "Last month: 26,500 kr" },
      { lab: "Active subscription value", v: "1,600", unit: "kr",       sub: "Point-in-time · active subscriptions" },
      { lab: "Net members",              v: "+9",                       sub: "+12 joined · −3 churned" },
    ],
    year: [
      { lab: "Bookings",                 v: "412",                      delta: "+8%",  trend: "up",   sub: "Last year: 381" },
      { lab: "Cash in",                  v: "294,200", unit: "kr",      delta: "+14%", trend: "up",   sub: "Last year: 258,000 kr" },
      { lab: "Active subscription value", v: "1,600", unit: "kr",       sub: "Point-in-time · active subscriptions" },
      { lab: "Net members",              v: "+34",                      sub: "+58 joined · −24 churned" },
    ],
  };

  const periodLabel = {
    week:  "Week commencing 27 Apr",
    month: "April 2025",
    year:  "Year to date · 2025",
  };

  // Bar chart data — each bar carries bookings + cash for the tooltip
  // Period-appropriate spans: 12 weeks / 12 months / 8 years
  const trendBars = period === "week"
    ? [
        { label: "9 Feb",  range: "9–15 Feb",   bookings: 22, cash: 14_200 },
        { label: "16 Feb", range: "16–22 Feb",  bookings: 35, cash: 22_400 },
        { label: "23 Feb", range: "23 Feb – 1 Mar", bookings: 41, cash: 26_900 },
        { label: "2 Mar",  range: "2–8 Mar",    bookings: 60, cash: 38_700 },
        { label: "9 Mar",  range: "9–15 Mar",   bookings: 38, cash: 24_600 },
        { label: "16 Mar", range: "16–22 Mar",  bookings: 28, cash: 18_100 },
        { label: "23 Mar", range: "23–29 Mar",  bookings: 15, cash: 9_800 },
        { label: "30 Mar", range: "30 Mar – 5 Apr", bookings: 19, cash: 12_300 },
        { label: "6 Apr",  range: "6–12 Apr",   bookings: 36, cash: 23_400 },
        { label: "13 Apr", range: "13–19 Apr",  bookings: 48, cash: 31_200 },
        { label: "20 Apr", range: "20–26 Apr",  bookings: 22, cash: 14_300 },
        { label: "27 Apr", range: "27 Apr – 3 May", bookings: 3,  cash: 8_500 },
      ]
    : period === "month"
    ? [
        { label: "May 2024", range: "May 2024", bookings: 38,  cash: 24_700 },
        { label: "Jun 2024", range: "Jun 2024", bookings: 52,  cash: 33_800 },
        { label: "Jul 2024", range: "Jul 2024", bookings: 41,  cash: 26_700 },
        { label: "Aug 2024", range: "Aug 2024", bookings: 60,  cash: 39_000 },
        { label: "Sep 2024", range: "Sep 2024", bookings: 75,  cash: 48_750 },
        { label: "Oct 2024", range: "Oct 2024", bookings: 58,  cash: 37_700 },
        { label: "Nov 2024", range: "Nov 2024", bookings: 49,  cash: 31_900 },
        { label: "Dec 2024", range: "Dec 2024", bookings: 66,  cash: 42_900 },
        { label: "Jan 2025", range: "Jan 2025", bookings: 72,  cash: 46_800 },
        { label: "Feb 2025", range: "Feb 2025", bookings: 80,  cash: 52_000 },
        { label: "Mar 2025", range: "Mar 2025", bookings: 68,  cash: 44_200 },
        { label: "Apr 2025", range: "Apr 2025", bookings: 47,  cash: 32_400 },
      ]
    : [
        { label: "2018", range: "2018", bookings: 180, cash: 117_000 },
        { label: "2019", range: "2019", bookings: 210, cash: 136_500 },
        { label: "2020", range: "2020", bookings: 145, cash: 94_300 },
        { label: "2021", range: "2021", bookings: 245, cash: 159_300 },
        { label: "2022", range: "2022", bookings: 290, cash: 188_500 },
        { label: "2023", range: "2023", bookings: 348, cash: 226_200 },
        { label: "2024", range: "2024", bookings: 380, cash: 247_000 },
        { label: "2025", range: "2025 YTD", bookings: 412, cash: 294_200 },
      ];

  const [hoverBar, setHoverBar] = React.useState(null);

  return (
    <SmShell active="home">
      <div className="sm-content" style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Greeting + period toggle */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
          <div className="sm-greeting">
            <h1>Home</h1>
            <p className="sub">{periodLabel[period]}</p>
          </div>
          <div className="sm-segments" style={{ marginBottom: 0 }}>
            {["week", "month", "year"].map(p => (
              <button
                key={p}
                className={"sm-segment " + (period === p ? "on" : "")}
                onClick={() => setPeriod(p)}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* KPI tiles 2x2 */}
        <div className="sm-kpis" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {kpis[period].map((k, i) => (
            <div key={i} className="sm-kpi">
              <div className="lab">{k.lab}</div>
              <div className="v">
                {k.v}
                {k.unit && <span style={{ fontSize: 16, color: "var(--ink-soft)", fontWeight: 500, marginLeft: 6 }}>{k.unit}</span>}
              </div>
              {k.delta && (
                <div className={"delta " + k.trend}>
                  {k.delta}
                  <span style={{ color: "var(--ink-muted)", marginLeft: 8 }}>{k.sub}</span>
                </div>
              )}
              {!k.delta && <div className="sub">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Unmet demand — conditional, hidden at zero. Demo data shows 0; uncomment to test populated state. */}
        {/* <div className="sm-section"> ... </div> */}

        {/* Booking trend bar chart with hover tooltip */}
        <div className="sm-section">
          <div className="sm-section-head">
            <h2>Booking trend</h2>
            <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>last bar = in progress</span>
          </div>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-card)",
            padding: "20px 24px 14px",
          }}>
            <div
              style={{
                height: 140,
                display: "flex", alignItems: "flex-end", gap: 6,
                borderBottom: "1px solid var(--line-soft)",
                paddingBottom: 4,
                position: "relative",
              }}
              onMouseLeave={() => setHoverBar(null)}
            >
              {trendBars.map((b, i) => {
                const isLast = i === trendBars.length - 1;
                const max = Math.max(...trendBars.map(x => x.bookings));
                const isHover = hoverBar === i;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoverBar(i)}
                    style={{
                      flex: 1,
                      height: `${(b.bookings / max) * 100}%`,
                      background: isLast ? "hsl(2 48% 78%)" : "var(--action)",
                      borderRadius: "3px 3px 0 0",
                      opacity: isLast ? 0.7 : (hoverBar === null || isHover ? 1 : 0.45),
                      cursor: "default",
                      transition: "opacity 80ms ease",
                    }}
                  ></div>
                );
              })}
              {hoverBar !== null && (() => {
                const b = trendBars[hoverBar];
                const pct = (hoverBar + 0.5) / trendBars.length * 100;
                const onRight = pct > 70;
                return (
                  <div style={{
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
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{b.range}</div>
                    <div style={{ opacity: 0.85 }}>{b.bookings} bookings · {b.cash.toLocaleString()} kr</div>
                  </div>
                );
              })()}
            </div>
            <div style={{
              display: "flex", gap: 6,
              fontSize: 11, color: "var(--ink-muted)",
              marginTop: 6, fontVariantNumeric: "tabular-nums",
            }}>
              {trendBars.map((b, i) => {
                // Show every Nth label so the axis is readable but not crowded.
                // 12 bars → every 3rd; 8 bars → every other. Always show first + last.
                const stride = trendBars.length >= 12 ? 3 : 2;
                const isLast = i === trendBars.length - 1;
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
        </div>

        {/* Class fill rate — per-class ranked, worst first, with scope toggle */}
        <FillRateCard period={period} />

        {/* Traffic — stacked bars by source + per-source conversion chips */}
        <TrafficCard period={period} />

      </div>
    </SmShell>
  );
};

window.HomeScreen = HomeScreen;
