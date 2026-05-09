#!/usr/bin/env bun
/**
 * Provision a new studio in the multi-tenant database.
 *
 * What it does (database-only):
 *   1. INSERT studios row with branding + per-studio config
 *   2. INSERT studio_payment_providers placeholder (Stripe, is_active=false until onboarded)
 *   3. INSERT a default location (so schedule rules have somewhere to point)
 *
 * What it does NOT do (manual steps printed at the end):
 *   - Vercel project + env vars
 *   - Stripe Connect onboarding for the customer
 *   - APP_URL allowlist append (Supabase secret)
 *   - Resend domain verification
 *   - Owner promotion (use scripts/promote-owner.ts after they first sign in)
 *   - Schedule rules + class templates (customer-specific, do via /manage UI)
 *
 * Usage:
 *   bun run scripts/provision-studio.ts \
 *     --slug=studio-foo \
 *     --name="Foo Yoga" \
 *     --email=hello@fooyoga.no \
 *     --primary-color="#8a7e6e" \
 *     --currency=NOK \
 *     --timezone=Europe/Oslo \
 *     --address="Oslo, Norway" \
 *     --app-url=https://fooyoga.no \
 *     --from-email=booking@fooyoga.no
 *
 * Required env (read from .env or shell):
 *   SUPABASE_URL                  e.g. https://xskqpxfjhhxontirezjd.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     service-role key (NOT the anon key)
 */

import { createClient } from "@supabase/supabase-js";

// ── Arg parsing ───────────────────────────────────────────────────────────────
type Args = {
  slug: string;
  name: string;
  email: string;
  primaryColor: string;
  currency: string;
  timezone: string;
  address: string;
  appUrl: string;
  fromEmail: string;
};

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
  }
  const required = ["slug", "name", "email", "app-url"];
  const missing = required.filter((k) => !flags[k]);
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.map((k) => `--${k}`).join(", ")}`);
    console.error(`Run with no flags to see usage.`);
    process.exit(1);
  }
  return {
    slug: flags["slug"],
    name: flags["name"],
    email: flags["email"],
    primaryColor: flags["primary-color"] ?? "#000000",
    currency: flags["currency"] ?? "NOK",
    timezone: flags["timezone"] ?? "Europe/Oslo",
    address: flags["address"] ?? "",
    appUrl: flags["app-url"],
    fromEmail: flags["from-email"] ?? "",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(__USAGE__);
    process.exit(0);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.");
    console.error("(Service role key — not the anon key. Find it in Supabase Dashboard → Project Settings → API.)");
    process.exit(1);
  }

  const args = parseArgs(argv);

  // Validate the slug — must be URL-safe.
  if (!/^[a-z0-9-]+$/.test(args.slug)) {
    console.error(`Invalid slug "${args.slug}" — must be lowercase letters, digits, and hyphens only.`);
    process.exit(1);
  }
  // Validate the URL — must parse and be https.
  try {
    const u = new URL(args.appUrl);
    if (u.protocol !== "https:") throw new Error("must be https");
  } catch (err) {
    console.error(`Invalid --app-url "${args.appUrl}": ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Step 1: Insert studios row
  console.log(`Provisioning studio "${args.slug}"...`);
  const { data: studio, error: studioErr } = await admin
    .from("studios")
    .insert({
      slug: args.slug,
      name: args.name,
      contact_email: args.email,
      primary_color: args.primaryColor,
      currency: args.currency,
      timezone: args.timezone,
      address: args.address,
      app_url: args.appUrl,
      from_email: args.fromEmail || null,
      is_active: true,
    })
    .select("id")
    .single();
  if (studioErr || !studio) {
    console.error(`Failed to insert studio:`, studioErr);
    process.exit(1);
  }
  const studioId = studio.id;
  console.log(`  ✓ Studio inserted: ${studioId}`);

  // Step 2: Insert placeholder Stripe provider row (inactive until customer onboards)
  const { error: providerErr } = await admin
    .from("studio_payment_providers")
    .insert({
      studio_id: studioId,
      provider: "stripe",
      provider_account_id: null,
      is_primary: true,
      is_active: false,
      onboarded_at: null,
    });
  if (providerErr) {
    console.error(`Failed to insert payment provider placeholder:`, providerErr);
    process.exit(1);
  }
  console.log(`  ✓ Payment provider placeholder inserted (Stripe, inactive)`);

  // Step 3: Insert a default location (must exist before schedule rules)
  const { error: locErr } = await admin
    .from("locations")
    .insert({
      studio_id: studioId,
      name: "Main studio",
      timezone: args.timezone,
      is_active: true,
    });
  if (locErr) {
    console.error(`Failed to insert default location:`, locErr);
    process.exit(1);
  }
  console.log(`  ✓ Default location inserted`);

  // ── Print remaining-steps checklist ─────────────────────────────────────────
  console.log("");
  console.log("Studio provisioned in the database.");
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("  Remaining manual steps (do these in order):");
  console.log("══════════════════════════════════════════════════════════");
  console.log("");
  console.log(`  1. Vercel — create the project for ${args.appUrl}`);
  console.log(`     - Import from GitHub (Bananapple/cami)`);
  console.log(`     - Set env vars (Production scope):`);
  console.log(`         VITE_SUPABASE_URL              = ${SUPABASE_URL}`);
  console.log(`         VITE_SUPABASE_PUBLISHABLE_KEY  = <anon key from Supabase>`);
  console.log(`         VITE_STUDIO_SLUG               = ${args.slug}`);
  console.log(`     - Connect custom domain if needed`);
  console.log("");
  console.log(`  2. Supabase auth — add the new redirect URL`);
  console.log(`     Authentication → URL Configuration → Redirect URLs:`);
  console.log(`         ${args.appUrl}/**`);
  console.log("");
  console.log(`  3. Append the new origin to APP_URL secret (CORS allowlist)`);
  console.log(`     Get current value:`);
  console.log(`         supabase secrets list --project-ref <ref> | grep APP_URL`);
  console.log(`     Set new value (comma-separated, include the new URL):`);
  console.log(`         supabase secrets set APP_URL="<existing>,${args.appUrl}" --project-ref <ref>`);
  console.log(`     Then redeploy create-checkout (the function reads APP_URL at startup):`);
  console.log(`         supabase functions deploy create-checkout --project-ref <ref>`);
  console.log("");
  console.log(`  4. Stripe Connect — onboard the customer`);
  console.log(`     - Customer goes through Stripe Connect onboarding from the platform dashboard`);
  console.log(`     - Note their connected account ID (acct_xxx)`);
  console.log(`     - Update the placeholder row:`);
  console.log(`         UPDATE studio_payment_providers`);
  console.log(`            SET provider_account_id = 'acct_xxx', is_active = true, onboarded_at = now()`);
  console.log(`          WHERE studio_id = '${studioId}';`);
  console.log("");
  console.log(`  5. Resend — verify the customer's sending domain`);
  console.log(`     - Add domain in Resend → Domains`);
  console.log(`     - Customer adds DNS records (DKIM/SPF)`);
  console.log(`     - When verified, set studios.from_email if not already:`);
  console.log(`         UPDATE studios SET from_email = '${args.fromEmail || "booking@<domain>"}' WHERE id = '${studioId}';`);
  console.log("");
  console.log(`  6. Owner promotion — after the customer signs in for the first time:`);
  console.log(`         bun run scripts/promote-owner.ts --slug=${args.slug} --email=<their-email>`);
  console.log("");
  console.log(`  7. Verify — visit ${args.appUrl}, check the home page renders + booking flow works`);
  console.log("");
  console.log(`  Studio ID for reference: ${studioId}`);
  console.log("");
}

const __USAGE__ = `
Usage: bun run scripts/provision-studio.ts [flags]

Required:
  --slug=<url-safe-slug>        e.g. fooyoga
  --name=<display-name>         e.g. "Foo Yoga"
  --email=<contact-email>       e.g. hello@fooyoga.no
  --app-url=<https-url>         e.g. https://fooyoga.no

Optional:
  --primary-color=<hex>         default #000000
  --currency=<ISO-4217>         default NOK
  --timezone=<IANA-tz>          default Europe/Oslo
  --address=<text>              default ""
  --from-email=<email>          default null (uses platform fallback until set)

Env (required):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`.trim();

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
