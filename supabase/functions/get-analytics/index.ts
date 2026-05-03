import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const POSTHOG_SECRET_KEY = Deno.env.get("POSTHOG_SECRET_KEY");
const POSTHOG_PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID") ?? "undefined";
const POSTHOG_HOST = "https://eu.posthog.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth: require valid JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const jwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { studio_id } = await req.json();
    if (!studio_id) return json({ error: "studio_id required" }, 400);

    // --- Verify caller is admin for this studio ---
    const { data: member, error: memberError } = await userClient
      .from("studio_members")
      .select("role")
      .eq("studio_id", studio_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member || member.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    // --- Query PostHog ---
    if (!POSTHOG_SECRET_KEY) {
      return json({ visitors: null, conversions: null, conversionRate: null, sources: null, noData: true });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateFrom = thirtyDaysAgo.toISOString().slice(0, 10);

    const phHeaders = {
      "Authorization": `Bearer ${POSTHOG_SECRET_KEY}`,
      "Content-Type": "application/json",
    };

    // Run queries in parallel
    const [visitorsRes, conversionsRes, sourcesRes] = await Promise.all([
      // Unique visitors (unique sessions)
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT count(DISTINCT session_id) as visitors
              FROM events
              WHERE event = '$pageview'
                AND timestamp >= '${dateFrom}'
                AND properties.studio_id = '${studio_id}'
            `,
          },
        }),
      }),
      // booking_completed events
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
      // Referrer sources breakdown
      fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: "POST",
        headers: phHeaders,
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              SELECT
                multiIf(
                  properties.$referring_domain = '' OR properties.$referring_domain IS NULL, 'Direct',
                  properties.$referring_domain LIKE '%google%' AND properties.$geoip_city_name IS NOT NULL, 'Maps',
                  properties.$referring_domain LIKE '%google%', 'Search',
                  properties.$referring_domain LIKE '%instagram%' OR properties.$utm_source LIKE '%instagram%', 'Instagram',
                  'Other'
                ) as source,
                count(DISTINCT session_id) as visits
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
    ]);

    const [visitorsData, conversionsData, sourcesData] = await Promise.all([
      visitorsRes.json(),
      conversionsRes.json(),
      sourcesRes.json(),
    ]);

    const visitors = visitorsData?.results?.[0]?.[0] ?? 0;
    const conversions = conversionsData?.results?.[0]?.[0] ?? 0;
    const conversionRate = visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0;

    const sourcesRaw: [string, number][] = sourcesData?.results ?? [];
    const totalVisits = sourcesRaw.reduce((s, [, v]) => s + v, 0);
    const sources = sourcesRaw.map(([name, visits]) => ({
      name,
      visits,
      pct: totalVisits > 0 ? Math.round((visits / totalVisits) * 100) : 0,
    }));

    return json({ visitors, conversions, conversionRate, sources, noData: visitors === 0 });
  } catch (err) {
    console.error("get-analytics error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
