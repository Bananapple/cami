// Shared CORS helper for Edge Functions.
//
// Replaces the per-function `Access-Control-Allow-Origin: "*"` pattern with an
// allowlist sourced from the APP_URL env var (which may be a comma-separated
// list of multiple studio deployment origins, e.g.
// "https://brie-hd7s.vercel.app,https://heycami.studio").
//
// Behavior:
//   - Browser request from an allowlisted origin → echo that origin
//   - Browser request from any other origin → return the first allowlisted
//     origin as a placeholder (browser sees the mismatch and blocks)
//   - Non-browser caller (no Origin header, e.g. Stripe webhook, curl) →
//     CORS doesn't apply, returns the first allowlisted origin as a placeholder
//   - APP_URL unset on Supabase Edge runtime → throw at module load, refuse
//     to start. Production must always have APP_URL set.
//   - APP_URL unset locally (`supabase functions serve`) → degrade to "*" so
//     dev/sandbox still works.
//
// Note on threat model:
//   With Bearer JWT auth (not cookies), CORS provides defense-in-depth, not
//   primary auth. A malicious page can still trigger requests; CORS only
//   prevents that page from reading the response. The Bearer token requirement
//   is what actually blocks unauthorized state changes.

const APP_URL = Deno.env.get("APP_URL") ?? "";
const ALLOWED_ORIGINS: string[] = APP_URL
  ? APP_URL.split(",").map((u) => {
      try { return new URL(u.trim()).origin; } catch { return ""; }
    }).filter(Boolean)
  : [];

// Supabase Edge runs on Deno Deploy, which sets DENO_DEPLOYMENT_ID. Local
// `supabase functions serve` does not set this var, so dev keeps the `*`
// fallback in corsHeaders() below for ergonomics. Production refuses to start
// with an empty allowlist — fail loud rather than fail open.
const IS_SUPABASE_EDGE = !!Deno.env.get("DENO_DEPLOYMENT_ID");
if (IS_SUPABASE_EDGE && ALLOWED_ORIGINS.length === 0) {
  throw new Error(
    "CORS misconfigured: APP_URL env var is empty on Supabase Edge runtime. " +
    "Set APP_URL to a comma-separated list of allowed origins via " +
    "`supabase secrets set APP_URL=\"https://your-studio.com,https://another.com\"`."
  );
}

const STANDARD_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-studio-slug",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

/**
 * Returns CORS headers for a given request. Echoes the request's Origin if it
 * is in the APP_URL allowlist; otherwise returns the first allowlisted origin
 * (or "*" if none are configured, for safe dev fallback).
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  let allowOrigin: string;

  if (ALLOWED_ORIGINS.length === 0) {
    // No allowlist configured — degrade to "*" so dev/sandbox doesn't break.
    allowOrigin = "*";
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    allowOrigin = origin;
  } else {
    // Origin not allowed — return the first allowed origin as a placeholder.
    // The browser will see the mismatch and block the response.
    allowOrigin = ALLOWED_ORIGINS[0];
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...STANDARD_HEADERS,
  };
}

/** Returns a JSON Response with CORS headers attached. */
export function jsonWithCors(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
