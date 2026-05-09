import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const POSTHOG_SECRET_KEY = Deno.env.get("POSTHOG_SECRET_KEY");
const POSTHOG_PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "undefined";
const POSTHOG_HOST = "https://us.posthog.com";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    // --- Auth: require valid JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);
    const jwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(req, { error: "Unauthorized" }, 401);

    const { studio_id, period = "day" } = await req.json();
    if (!studio_id) return json(req, { error: "studio_id required" }, 400);
    // studio_id is interpolated into HogQL queries below — reject anything
    // that isn't a UUID before it reaches a query builder.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studio_id)) {
      return json(req, { error: "studio_id must be a UUID" }, 400);
    }

    // --- Verify caller is admin for this studio ---
    const { data: member, error: memberError } = await userClient
      .from("studio_members")
      .select("role")
      .eq("studio_id", studio_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member || !["owner", "manager"].includes(member.role)) {
      return json(req, { error: "Forbidden" }, 403);
    }

    // --- Query PostHog ---
    if (!POSTHOG_SECRET_KEY) {
      return json(req, { visitors: null, conversions: null, conversionRate: null, sources: null, noData: true });
    }

    const now = new Date();
    const periodDays = ({ day: 30, week: 210, month: 900, year: 1825 } as Record<string, number>)[period] ?? 30;
    const groupFn = ({ day: "toDate(timestamp)", week: "toMonday(timestamp)", month: "toStartOfMonth(timestamp)", year: "toStartOfYear(timestamp)" } as Record<string, string>)[period] ?? "toDate(timestamp)";
    const dateFrom = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const phHeaders = {
      "Authorization": `Bearer ${POSTHOG_SECRET_KEY}`,
      "Content-Type": "application/json",
    };

    // Priority: known referrer → UTM from URL (PostHog doesn't extract $utm_source into event props) → Direct → Other
    // maps.google.com referrer is the reliable Maps signal; $geoip_city_name is present for all geocoded traffic so it can't distinguish Maps from Search
    const sourceExpr = `multiIf(
      properties.$referring_domain LIKE '%maps.google%', 'Maps',
      properties.$referring_domain LIKE '%google%', 'Search',
      properties.$referring_domain LIKE '%instagram%', 'Instagram',
      properties.$referring_domain LIKE '%facebook%', 'Facebook',
      properties.$referring_domain LIKE '%tiktok%', 'TikTok',
      extractURLParameter(properties.$current_url, 'utm_source') LIKE '%instagram%', 'Instagram',
      extractURLParameter(properties.$current_url, 'utm_source') LIKE '%facebook%', 'Facebook',
      extractURLParameter(properties.$current_url, 'utm_source') LIKE '%tiktok%', 'TikTok',
      extractURLParameter(properties.$current_url, 'utm_source') LIKE '%google%', 'Search',
      properties.$referring_domain = '' OR properties.$referring_domain IS NULL, 'Direct',
      'Other'
    )`;

    // Run queries in parallel
    const [visitorsRes, dailyRes, conversionsRes, dailyConversionsRes, sourcesRes, dailyBySourceRes, sourceConversionsRes] = await Promise.all([
      // Unique people over 30 days — any event with studio_id (catches pageleave + pageview)
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT count(DISTINCT distinct_id) as visitors
              FROM events
              WHERE timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
                AND event NOT IN ('$feature_flag_called', '$exception')
            `,
          },
        }),
      }),
      // Visitors grouped by period unit
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT ${groupFn} as date, count(DISTINCT distinct_id) as daily_uniques
              FROM events
              WHERE timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
                AND event NOT IN ('$feature_flag_called', '$exception')
              GROUP BY date
              ORDER BY date
            `,
          },
        }),
      }),
      // booking_completed events (total)
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT count() as conversions
              FROM events
              WHERE event = 'booking_completed'
                AND timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
            `,
          },
        }),
      }),
      // booking_completed events grouped by period unit
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT ${groupFn} as date, count() as daily_conversions
              FROM events
              WHERE event = 'booking_completed'
                AND timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
              GROUP BY date
              ORDER BY date
            `,
          },
        }),
      }),
      // Sources aggregate (visit share + conv rate via simple per-source query)
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT
                ${sourceExpr} as source,
                count(DISTINCT distinct_id) as visits
              FROM events
              WHERE event = '$pageview'
                AND timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
              GROUP BY source
              ORDER BY visits DESC
            `,
          },
        }),
      }),
      // Visitors by source grouped by period unit (stacked area chart)
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT
                ${groupFn} as date,
                ${sourceExpr} as source,
                count(DISTINCT distinct_id) as visits
              FROM events
              WHERE event = '$pageview'
                AND timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
              GROUP BY date, source
              ORDER BY date, source
            `,
          },
        }),
      }),
      // booking_completed per source (for per-source conv rate)
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT
                ${sourceExpr} as source,
                count() as conversions
              FROM events
              WHERE event = 'booking_completed'
                AND timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
              GROUP BY source
            `,
          },
        }),
      }),
    ]);

    const [visitorsData, dailyData, conversionsData, dailyConversionsData, sourcesData, dailyBySourceData, sourceConversionsData] = await Promise.all([
      visitorsRes.json(),
      dailyRes.json(),
      conversionsRes.json(),
      dailyConversionsRes.json(),
      sourcesRes.json(),
      dailyBySourceRes.json(),
      sourceConversionsRes.json(),
    ]);

    const visitors = visitorsData?.results?.[0]?.[0] ?? 0;
    const conversions = conversionsData?.results?.[0]?.[0] ?? 0;
    const conversionRate = visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0;

    const dailyBreakdown: { date: string; count: number }[] =
      (dailyData?.results ?? []).map(([date, count]: [string, number]) => ({ date, count }));
    const dailyConversions: { date: string; count: number }[] =
      (dailyConversionsData?.results ?? []).map(([date, count]: [string, number]) => ({ date, count }));
    const avgPerDay = dailyBreakdown.length > 0
      ? Math.round(dailyBreakdown.reduce((s, d) => s + d.count, 0) / periodDays)
      : 0;

    const sourcesRaw: [string, number][] = sourcesData?.results ?? [];
    const totalVisits = sourcesRaw.reduce((s, [, v]) => s + v, 0);
    const convBySource = new Map<string, number>(
      (sourceConversionsData?.results ?? []).map(([src, c]: [string, number]) => [src, c])
    );
    const sources = sourcesRaw.map(([name, visits]) => ({
      name,
      visits,
      pct: totalVisits > 0 ? Math.round((visits / totalVisits) * 100) : 0,
      convRate: visits > 0 ? Math.round(((convBySource.get(name) ?? 0) / visits) * 1000) / 10 : 0,
    }));
    console.log("get-analytics:", { studioId: studio_id, period, visitors, sources: sources.map(s => s.name) });

    const dailyBySource: { date: string; source: string; count: number }[] =
      (dailyBySourceData?.results ?? []).map(([date, source, count]: [string, string, number]) => ({ date, source, count }));

    return json(req, { visitors, avgPerDay, dailyBreakdown, dailyConversions, conversions, conversionRate, sources, dailyBySource, noData: dailyBreakdown.length === 0 });
  } catch (err) {
    console.error("get-analytics error:", err);
    return json(req, { error: "Internal error" }, 500);
  }
});
