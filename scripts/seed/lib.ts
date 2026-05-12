// Shared helpers for the test-account seed scripts.
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env. Service role is
// required for setup; daily script uses anon + per-user signInWithPassword.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Persona, TimeBucket, TemplateName } from "./personas";

// ── Config ─────────────────────────────────────────────────────────────
export const TEST_STUDIO_SLUG = process.env.TEST_STUDIO_SLUG ?? "brie-demo";
// Single password used for every test account so the daily script can sign
// each one in. Lives in env so the value never gets committed.
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

const SUPABASE_URL = required("SUPABASE_URL");

// Two clients with different privilege:
//   admin — service-role, used for setup/backfill (bypasses RLS)
//   anon  — anon key, used to mimic a real user calling Edge Functions
export const admin: SupabaseClient = createClient(
  SUPABASE_URL,
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, required("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-studio-slug": TEST_STUDIO_SLUG } },
  });
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

// ── Studio + schema lookups (cached for a single script run) ───────────
let _studioId: string | null = null;
let _studioTimezone: string | null = null;
export async function getStudio(): Promise<{ id: string; timezone: string }> {
  if (_studioId && _studioTimezone) return { id: _studioId, timezone: _studioTimezone };
  const { data, error } = await admin
    .from("studios")
    .select("id, timezone")
    .eq("slug", TEST_STUDIO_SLUG)
    .single();
  if (error || !data) {
    throw new Error(
      `Studio ${TEST_STUDIO_SLUG} not found. Run scripts/seed-demo-studio.sql in Supabase SQL Editor first.`,
    );
  }
  _studioId = data.id;
  _studioTimezone = data.timezone;
  return { id: data.id, timezone: data.timezone };
}

let _templates: { id: string; name: string; default_duration_minutes: number; default_max_capacity: number; default_instructor_id: string | null; default_price: number }[] | null = null;
export async function getTemplates() {
  if (_templates) return _templates;
  const { id: studioId } = await getStudio();
  const { data, error } = await admin
    .from("class_templates")
    .select("id, name, default_duration_minutes, default_max_capacity, default_instructor_id, default_price")
    .eq("studio_id", studioId)
    .eq("is_active", true);
  if (error || !data || data.length === 0) {
    throw new Error(`No class_templates found for ${TEST_STUDIO_SLUG}`);
  }
  _templates = data;
  return data;
}

export async function templateByName(name: TemplateName) {
  const tpls = await getTemplates();
  const t = tpls.find((x) => x.name === name);
  if (!t) throw new Error(`Class template "${name}" missing on ${TEST_STUDIO_SLUG}`);
  return t;
}

let _location: { id: string } | null = null;
export async function getLocation() {
  if (_location) return _location;
  const { id: studioId } = await getStudio();
  const { data, error } = await admin
    .from("locations")
    .select("id")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No active location on ${TEST_STUDIO_SLUG}`);
  _location = data;
  return data;
}

let _products: { id: string; name: string; type: string; credits: number | null; validity_days: number | null; billing_interval: string | null }[] | null = null;
export async function getProducts() {
  if (_products) return _products;
  const { id: studioId } = await getStudio();
  const { data, error } = await admin
    .from("products")
    .select("id, name, type, credits, validity_days, billing_interval")
    .eq("studio_id", studioId)
    .eq("is_active", true);
  if (error || !data) throw new Error(`No products on ${TEST_STUDIO_SLUG}`);
  _products = data;
  return data;
}

// ── User + membership helpers ──────────────────────────────────────────

export async function ensureUser(persona: Persona): Promise<{ userId: string; created: boolean }> {
  if (!TEST_USER_PASSWORD) {
    throw new Error("TEST_USER_PASSWORD env var required for ensureUser");
  }
  // List + match by email. Avoids the "user already exists" error path.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === persona.email);
  if (existing) {
    return { userId: existing.id, created: false };
  }
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: persona.email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: persona.fullName, seed_persona: persona.id },
  });
  if (createErr || !created.user) throw createErr ?? new Error("createUser returned no user");
  // Profile row — profiles.id == auth.users.id. Some projects auto-create via trigger.
  await admin.from("profiles").upsert(
    { id: created.user.id, email: persona.email, full_name: persona.fullName },
    { onConflict: "id" },
  );
  return { userId: created.user.id, created: true };
}

export async function ensureStudioMember(persona: Persona, userId: string): Promise<string> {
  const { id: studioId } = await getStudio();
  const joinedAt = daysAgoIso(joinedDaysAgoForPersona(persona));
  const row = {
    studio_id: studioId,
    user_id: userId,
    role: "member" as const,
    source: persona.source,
    status: persona.status ?? "active",
    joined_at: joinedAt,
  };
  const { data, error } = await admin
    .from("studio_members")
    .upsert(row, { onConflict: "studio_id,user_id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function joinedDaysAgoForPersona(p: Persona): number {
  if (p.id === "maya") return 5;
  if (p.id === "nia") return 8;
  if (p.history.totalBookings === 0) return 5;
  return Math.min(180, p.history.oldestDaysAgo + 10);
}

export async function ensureMembership(persona: Persona, userId: string): Promise<string | null> {
  if (!persona.plan) return null;
  const { id: studioId } = await getStudio();
  const products = await getProducts();
  const product = products.find((p) => p.name === persona.plan!.productName);
  if (!product) throw new Error(`Product "${persona.plan.productName}" missing on ${TEST_STUDIO_SLUG}`);

  const validUntil = daysAgoIso(-persona.plan.validUntilDaysFromNow).slice(0, 10); // DATE

  // Compute credits + status based on plan type.
  const creditsRemaining =
    persona.plan.type === "clip_card" ? persona.plan.creditsRemaining : null;
  const status =
    persona.plan.type === "subscription" && persona.plan.cancelled === true
      ? "cancelled"
      : "active";

  const row = {
    studio_id: studioId,
    user_id: userId,
    product_id: product.id,
    plan_name: product.name,
    status,
    credits_remaining: creditsRemaining,
    valid_until: validUntil,
  };
  const { data, error } = await admin
    .from("memberships")
    .upsert(row, { onConflict: "studio_id,user_id,product_id" })
    .select("id")
    .single();
  if (error) {
    // The memberships table doesn't have a unique constraint on (studio,user,product)
    // in every schema version — fall back to insert if upsert fails on conflict spec.
    const ins = await admin.from("memberships").insert(row).select("id").single();
    if (ins.error) throw ins.error;
    return ins.data.id;
  }
  return data.id;
}

// ── Class instance + booking helpers ───────────────────────────────────

// Insert a synthetic past class_instance for backfill. status='completed',
// rule_id=NULL (treated as a one-off). starts_at is local studio time → UTC.
export async function insertPastClassInstance(opts: {
  templateName: TemplateName;
  time: TimeBucket;
  daysAgo: number;
}): Promise<string> {
  const { id: studioId, timezone } = await getStudio();
  const tpl = await templateByName(opts.templateName);
  const loc = await getLocation();
  const startHour = startHourForBucket(opts.time);
  const startLocal = new Date();
  startLocal.setDate(startLocal.getDate() - opts.daysAgo);
  // Studio local hour; for our test studio (Europe/Oslo) this is fine if the
  // runner is UTC — the small offset is below the bucket boundaries (5/11/15).
  startLocal.setHours(startHour, 0, 0, 0);
  const startsAt = localStudioTimeToUtc(startLocal, timezone);
  const endsAt = new Date(startsAt.getTime() + tpl.default_duration_minutes * 60_000);

  const { data, error } = await admin
    .from("class_instances")
    .insert({
      studio_id: studioId,
      template_id: tpl.id,
      rule_id: null,
      location_id: loc.id,
      instructor_id: tpl.default_instructor_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: tpl.default_price,
      max_capacity: tpl.default_max_capacity,
      status: "completed",
      notes: "[seed] backfilled for audience-model test data",
    })
    .select("id")
    .single();
  if (error || !data) throw error;
  return data.id;
}

export function startHourForBucket(b: TimeBucket): number {
  switch (b) {
    case "morning": return 7;  // 07:00
    case "midday": return 12;  // 12:00
    case "evening": return 19; // 19:00 — Gio's 21:30 case handled separately in setup.ts
  }
}

// Convert a Date object representing a "wall clock" in the studio's local
// timezone to a real UTC Date. Simple offset trick suitable for fixed-offset
// regions (Europe/Oslo is +1 / +2 DST — we err to UTC+1 baseline for seed
// dates which is good enough for bucket math; DST drift of 1h still buckets
// the same morning/midday/evening).
export function localStudioTimeToUtc(local: Date, _tz: string): Date {
  // Treat the local time as if it were in UTC, then subtract the offset.
  // For Oslo, that's UTC-1 (or -2 in summer); 7am local → 6am UTC.
  // Simpler: use the Date as-is (interpreting via local system TZ would be
  // wrong on a UTC GitHub runner). We construct an ISO that asserts the
  // studio offset directly.
  const offsetMinutes = stdOffsetMinutes(_tz);
  const utc = new Date(local.getTime() - offsetMinutes * 60_000);
  return utc;
}

function stdOffsetMinutes(tz: string): number {
  // Standard offset (no DST). Sufficient for time-bucket assignment since
  // DST keeps morning/midday/evening boundaries intact.
  switch (tz) {
    case "Europe/Oslo":
    case "Europe/Berlin":
    case "Europe/Paris":
      return 60;
    case "America/New_York":
      return -300;
    case "America/Los_Angeles":
      return -480;
    default:
      return 0;
  }
}

export async function insertBooking(opts: {
  studioId: string;
  userId: string;
  classInstanceId: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  bookedAt: string;
  membershipId: string | null;
}): Promise<string | null> {
  const { error } = await admin.from("bookings").insert({
    studio_id: opts.studioId,
    user_id: opts.userId,
    class_instance_id: opts.classInstanceId,
    status: opts.status,
    booked_at: opts.bookedAt,
    membership_id: opts.membershipId,
    payment_id: null,
    amount_paid: 0,
  });
  if (error) {
    // 23505 = UNIQUE violation (user_id, class_instance_id). Idempotent skip.
    if ((error as any).code === "23505") return null;
    throw error;
  }
  return "ok";
}

// ── Date helpers ───────────────────────────────────────────────────────

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

// Random int in [min, max] inclusive.
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickWeighted<T>(items: T[], weight: (x: T) => number): T {
  const total = items.reduce((s, x) => s + weight(x), 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= weight(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}
