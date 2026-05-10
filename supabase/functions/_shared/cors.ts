// Shared CORS helper for Edge Functions.
//
// Replaces the per-function `Access-Control-Allow-Origin: "*"` pattern with an
// allowlist sourced from the APP_URL env var (which may be a comma-separated
// list of multiple studio deployment origins, e.g.
// "https://brie-hd7s.vercel.app,https://heycami.studio").
//
// Wildcards: an entry containing `*` is matched as a glob, where `*` matches
// any character except `.` and `/`. This unblocks Vercel preview origins like
// `https://*-nicholas-de-vibes-projects.vercel.app` without exposing
// arbitrary subdomains. Subdomain-only wildcards (`https://*.vercel.app`) are
// also supported.
//
// Behavior:
//   - Browser request from an allowlisted origin (literal or wildcard match) →
//     echo that origin
//   - Browser request from any other origin → return a concrete allowlisted
//     origin as placeholder (browser sees the mismatch and blocks)
//   - Non-browser caller (no Origin header, e.g. Stripe webhook, curl) →
//     CORS doesn't apply, returns the placeholder
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

type OriginMatcher = { kind: "literal"; value: string } | { kind: "regex"; pattern: RegExp };

function compileEntry(raw: string): OriginMatcher | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes("*")) {
    // Glob → regex. Escape regex metacharacters first, then convert `\*` to
    // `[^./]+` so a single `*` matches one path/subdomain segment but not a
    // dotted suffix (e.g. `https://*.vercel.app` accepts `foo.vercel.app`
    // but rejects `evil.com.vercel.app`).
    const escaped = trimmed
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^./]+");
    return { kind: "regex", pattern: new RegExp(`^${escaped}$`) };
  }

  // Literal origin — normalize via URL parsing so trailing slashes etc. don't
  // break matches.
  try {
    return { kind: "literal", value: new URL(trimmed).origin };
  } catch {
    return null;
  }
}

const APP_URL = Deno.env.get("APP_URL") ?? "";
const ALLOWED_ORIGINS: OriginMatcher[] = APP_URL
  ? APP_URL.split(",")
      .map(compileEntry)
      .filter((m): m is OriginMatcher => m !== null)
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

// Placeholder origin returned when a request's Origin doesn't match the
// allowlist. Must be a concrete value (regex patterns can't go in headers),
// so prefer the first literal entry, falling back to "*" only if every entry
// is a wildcard (which should never happen in production).
const FIRST_LITERAL = ALLOWED_ORIGINS.find(
  (m): m is { kind: "literal"; value: string } => m.kind === "literal",
);
const PLACEHOLDER_ORIGIN = FIRST_LITERAL?.value ?? "*";

function isAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some((m) =>
    m.kind === "literal" ? m.value === origin : m.pattern.test(origin),
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
 * matches the APP_URL allowlist (literal or wildcard); otherwise returns the
 * placeholder origin so the browser sees the mismatch and blocks the response.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  let allowOrigin: string;

  if (ALLOWED_ORIGINS.length === 0) {
    // No allowlist configured — degrade to "*" so dev/sandbox doesn't break.
    // This branch is only reachable locally; the module-load guard above
    // throws on Supabase Edge if the allowlist is empty.
    allowOrigin = "*";
  } else if (origin && isAllowed(origin)) {
    allowOrigin = origin;
  } else {
    allowOrigin = PLACEHOLDER_ORIGIN;
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
