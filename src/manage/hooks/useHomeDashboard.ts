import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export type Period = "week" | "month" | "year";

export type AnalyticsData = {
  visitors: number | null;
  avgPerDay: number | null;
  dailyBreakdown: { date: string; count: number }[];
  conversions: number | null;
  conversionRate: number | null;
  sources: { name: string; visits: number; pct: number }[];
  noData: boolean;
};

export type SparkPoint = { label: string; count: number };

export type UnmetDemand = {
  total: number;
  bottleneckName: string | null;
};

function getPeriodBounds(period: Period): {
  periodStart: Date;
  periodEnd: Date;
  priorStart: Date;
  priorEnd: Date;
  priorFullEnd: Date;
} {
  const now = new Date();

  let periodStart: Date;
  let priorFullStart: Date;
  let priorFullEnd: Date;

  if (period === "week") {
    // Monday of current week
    const day = now.getDay(); // 0=Sun
    const diff = (day + 6) % 7;
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - diff);
    periodStart.setHours(0, 0, 0, 0);

    priorFullEnd = new Date(periodStart);
    priorFullStart = new Date(priorFullEnd);
    priorFullStart.setDate(priorFullStart.getDate() - 7);
  } else if (period === "month") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    priorFullEnd = new Date(periodStart);
    priorFullStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1);
    priorFullEnd = new Date(periodStart);
    priorFullStart = new Date(now.getFullYear() - 1, 0, 1);
  }

  // Same elapsed duration into prior period
  const elapsed = now.getTime() - periodStart.getTime();
  const priorStart = priorFullStart;
  const priorEnd = new Date(priorFullStart.getTime() + elapsed);

  return { periodStart, periodEnd: now, priorStart, priorEnd, priorFullEnd };
}

function getSparkPeriods(period: Period): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const periods: { start: Date; end: Date; label: string }[] = [];

  for (let i = 12; i >= 1; i--) {
    if (period === "week") {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - diff - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      periods.push({
        start: weekStart,
        end: weekEnd,
        label: weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      });
    } else if (period === "month") {
      const d = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      periods.push({
        start: d,
        end,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
      });
    } else {
      const yr = now.getFullYear() - i;
      periods.push({
        start: new Date(yr, 0, 1),
        end: new Date(yr + 1, 0, 1),
        label: String(yr),
      });
    }
  }
  return periods;
}

export function useHomeDashboard(period: Period) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id ?? "";
  const isStaff = ["owner", "manager"].includes(studioCtx?.role ?? "");
  const currency = studioCtx?.studio?.currency ?? "NOK";

  const { periodStart, periodEnd, priorStart, priorEnd, priorFullEnd } = getPeriodBounds(period);

  const ps = periodStart.toISOString();
  const pe = periodEnd.toISOString();
  const prs = priorStart.toISOString();
  const pre = priorEnd.toISOString();
  const prfe = priorFullEnd.toISOString();

  // --- Bookings ---
  const bookingsQuery = useQuery({
    queryKey: ["home", "bookings", studioId, period, ps],
    enabled: !!studioId,
    queryFn: async () => {
      const [cur, prior, priorFull] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .eq("studio_id", studioId).eq("status", "confirmed")
          .gte("created_at", ps).lt("created_at", pe),
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .eq("studio_id", studioId).eq("status", "confirmed")
          .gte("created_at", prs).lt("created_at", pre),
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .eq("studio_id", studioId).eq("status", "confirmed")
          .gte("created_at", prs).lt("created_at", prfe),
      ]);
      return {
        current: cur.count ?? 0,
        prior: prior.count ?? 0,
        priorFull: priorFull.count ?? 0,
      };
    },
  });

  // --- Cash in ---
  const cashQuery = useQuery({
    queryKey: ["home", "cash", studioId, period, ps],
    enabled: !!studioId,
    queryFn: async () => {
      const [cur, prior, priorFull] = await Promise.all([
        supabase.from("payments").select("amount_minor")
          .eq("studio_id", studioId).eq("status", "succeeded")
          .gte("created_at", ps).lt("created_at", pe),
        supabase.from("payments").select("amount_minor")
          .eq("studio_id", studioId).eq("status", "succeeded")
          .gte("created_at", prs).lt("created_at", pre),
        supabase.from("payments").select("amount_minor")
          .eq("studio_id", studioId).eq("status", "succeeded")
          .gte("created_at", prs).lt("created_at", prfe),
      ]);
      const sum = (rows: { amount_minor: number }[] | null) =>
        (rows ?? []).reduce((s, r) => s + (r.amount_minor ?? 0), 0) / 100;
      return {
        current: sum(cur.data),
        prior: sum(prior.data),
        priorFull: sum(priorFull.data),
        currency,
      };
    },
  });

  // --- MRR ---
  const mrrQuery = useQuery({
    queryKey: ["home", "mrr", studioId],
    enabled: !!studioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("products(price_minor)")
        .eq("studio_id", studioId)
        .eq("status", "active")
        .eq("products.type", "subscription");
      const total = (data ?? []).reduce((s, m) => {
        const price = (m.products as any)?.price_minor ?? 0;
        return s + price;
      }, 0) / 100;
      return { total, currency };
    },
  });

  // --- Net members ---
  const membersQuery = useQuery({
    queryKey: ["home", "members", studioId, period, ps],
    enabled: !!studioId,
    queryFn: async () => {
      const [newRows, churnRows] = await Promise.all([
        supabase.from("studio_members").select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .gte("created_at", ps).lt("created_at", pe),
        supabase.from("memberships").select("id", { count: "exact", head: true })
          .eq("studio_id", studioId).eq("status", "cancelled")
          .gte("updated_at", ps).lt("updated_at", pe),
      ]);
      const added = newRows.count ?? 0;
      const churned = churnRows.count ?? 0;
      return { added, churned, net: added - churned };
    },
  });

  // --- Sparkline (trailing 12 complete periods) ---
  const sparkPeriods = getSparkPeriods(period);
  const sparkQuery = useQuery({
    queryKey: ["home", "spark", studioId, period],
    enabled: !!studioId,
    queryFn: async () => {
      const results: SparkPoint[] = [];
      for (const p of sparkPeriods) {
        const { count } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .eq("status", "confirmed")
          .gte("created_at", p.start.toISOString())
          .lt("created_at", p.end.toISOString());
        results.push({ label: p.label, count: count ?? 0 });
      }
      return results;
    },
  });

  // --- Fill rate ---
  const fillQuery = useQuery({
    queryKey: ["home", "fill", studioId, period, ps],
    enabled: !!studioId,
    queryFn: async () => {
      const { data: instances } = await supabase
        .from("class_instances")
        .select("id, max_capacity")
        .eq("studio_id", studioId)
        .gte("starts_at", ps)
        .lt("starts_at", pe);

      if (!instances?.length) return null;

      const ids = instances.map((i) => i.id);
      const { count: bookedCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("class_instance_id", ids)
        .eq("status", "confirmed");

      const totalCapacity = instances.reduce((s, i) => s + (i.max_capacity ?? 0), 0);
      if (!totalCapacity) return null;
      return Math.round(((bookedCount ?? 0) / totalCapacity) * 100);
    },
  });

  // --- Unmet demand ---
  const unmetQuery = useQuery({
    queryKey: ["home", "unmet", studioId, period, ps],
    enabled: !!studioId,
    queryFn: async () => {
      // Past class instances in period
      const { data: instances } = await supabase
        .from("class_instances")
        .select("id, template_id")
        .eq("studio_id", studioId)
        .gte("starts_at", ps)
        .lt("starts_at", pe);

      if (!instances?.length) return { total: 0, bottleneckName: null };

      const ids = instances.map((i) => i.id);
      const { data: waitRows } = await supabase
        .from("waitlists")
        .select("class_instance_id, status")
        .in("class_instance_id", ids)
        .in("status", ["expired", "waiting"]);

      if (!waitRows?.length) return { total: 0, bottleneckName: null };

      const total = waitRows.length;

      // Find bottleneck template
      const instanceMap = Object.fromEntries(instances.map((i) => [i.id, i.template_id]));
      const templateCounts: Record<string, number> = {};
      for (const row of waitRows) {
        const tId = instanceMap[row.class_instance_id];
        if (tId) templateCounts[tId] = (templateCounts[tId] ?? 0) + 1;
      }
      const bottleneckId = Object.entries(templateCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      let bottleneckName: string | null = null;
      if (bottleneckId) {
        const { data: tmpl } = await supabase
          .from("class_templates")
          .select("name")
          .eq("id", bottleneckId)
          .single();
        bottleneckName = tmpl?.name ?? null;
      }

      return { total, bottleneckName } as UnmetDemand;
    },
  });

  // --- Traffic (PostHog via Edge Function) ---
  const analyticsQuery = useQuery({
    queryKey: ["home", "analytics", studioId],
    enabled: !!studioId && isStaff,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-analytics`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ studio_id: studioId }),
      });
      if (!res.ok) throw new Error(`get-analytics ${res.status}`);
      return res.json() as Promise<AnalyticsData>;
    },
  });

  const isLoading =
    bookingsQuery.isLoading ||
    cashQuery.isLoading ||
    mrrQuery.isLoading ||
    membersQuery.isLoading ||
    sparkQuery.isLoading ||
    fillQuery.isLoading ||
    unmetQuery.isLoading;

  const error =
    bookingsQuery.error ||
    cashQuery.error ||
    mrrQuery.error ||
    membersQuery.error ||
    sparkQuery.error ||
    fillQuery.error ||
    unmetQuery.error;

  return {
    bookings: bookingsQuery.data,
    cash: cashQuery.data,
    mrr: mrrQuery.data,
    members: membersQuery.data,
    spark: sparkQuery.data ?? [],
    fillRate: fillQuery.data ?? null,
    unmet: unmetQuery.data ?? { total: 0, bottleneckName: null },
    analytics: analyticsQuery.data ?? null,
    analyticsLoading: analyticsQuery.isLoading,
    periodStart,
    isLoading,
    error,
  };
}
