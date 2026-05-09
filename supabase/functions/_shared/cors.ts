// Shared CORS helper for Edge Functions.
//
// Replaces the per-function `Access-Control-Allow-Origin: "*"` pattern with an
// allowlist sourced from the APP_URL env var (which may be a comma-separated
// list of multiple studio deployment origins, e.g.
// "https://brie-hd7s.vercel.app,https://heycami.studio").
//
// Behavior:
//   - Browser request from an allowlisted origin → echo that origin
//   - Browser request from any other origin → return null (browser blocks)
//   - Non-browser caller (no Origin header, e.g. Stripe webhook, curl) →
//     CORS doesn't apply, returns the first allowlisted origin as the placeholder
//   - APP_URL unset or empty → safe degraded mode, returns "*" so legitimate
//     callers aren't broken in dev environments. Production should always set APP_URL.
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
