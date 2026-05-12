#!/usr/bin/env bun
/**
 * Daily test-booking cron.
 *
 * Runs once per day (via GitHub Actions). For each persona, with their
 * configured probability, sign in and book a future class matching their
 * preferred template + time bucket. Optionally cancel an upcoming booking.
 *
 * Idempotent within a day — bookings are UNIQUE on (user_id, class_instance_id)
 * so a re-run won't double-book the same class.
 *
 * Auth path: signInWithPassword → call create-checkout Edge Function. With
 * active memberships the membership-credit path returns { free: true }
 * immediately (no Stripe), so this exercises the real Edge Function code
 * path without the payment redirect.
 *
 * Usage:
 *   bun run scripts/seed/daily.ts             # run for real
 *   bun run scripts/seed/daily.ts --dry-run   # log decisions, write nothing
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY         (for finding user + class candidates)
 *   TEST_USER_PASSWORD
 *   TEST_STUDIO_SLUG                  (optional, defaults to "brie-demo")
 */

import {
  TEST_STUDIO_SLUG,
  admin,
  anonClient,
  getStudio,
  templateByName,
} from "./lib";
import { PERSONAS, type Persona, type TimeBucket } from "./personas";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n=== seed/daily → ${TEST_STUDIO_SLUG} ===`);
  if (DRY_RUN) console.log("(dry-run: no bookings will be created)");

  const studio = await getStudio();
  let booked = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const persona of PERSONAS) {
    const roll = Math.random();
    const bookToday = roll < persona.daily.bookProbability;
    if (!bookToday) {
      skipped += 1;
      continue;
    }

    try {
      const userId = await findUserId(persona.email);
      if (!userId) {
        console.warn(`• ${persona.id}: user not found — run setup.ts first`);
        skipped += 1;
        continue;
      }

      const candidate = await findFutureClass(persona, studio.id, userId);
      if (!candidate) {
        console.log(`• ${persona.id}: no suitable future class found, skip`);
        skipped += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(`• ${persona.id}: would book ${candidate.template_name} at ${candidate.starts_at}`);
        continue;
      }

      const ok = await bookAsPersona(persona.email, candidate.id);
      if (ok) {
        booked += 1;
        console.log(`✓ ${persona.id}: booked ${candidate.template_name} ${humanTime(candidate.starts_at)}`);
      } else {
        skipped += 1;
      }

      // Optional cancellation.
      if (Math.random() < persona.daily.cancelProbability) {
        const target = await findExistingFutureBooking(persona.email, studio.id);
        if (target) {
          const c = await cancelAsPersona(persona.email, target.bookingId);
          if (c) {
            cancelled += 1;
            console.log(`✗ ${persona.id}: cancelled an upcoming booking`);
          }
        }
      }
    } catch (e) {
      console.warn(`• ${persona.id}: error —`, (e as Error).message);
    }
  }

  console.log(`\n=== summary ===`);
  console.log(`Booked:    ${booked}`);
  console.log(`Cancelled: ${cancelled}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Done.\n`);
}

async function findUserId(email: string): Promise<string | null> {
  // Cache via Map across calls within this run to avoid repeated listUsers.
  if (_userCache.size === 0) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email) _userCache.set(u.email, u.id);
  }
  return _userCache.get(email) ?? null;
}
const _userCache = new Map<string, string>();

async function findFutureClass(
  persona: Persona,
  studioId: string,
  userId: string,
): Promise<{ id: string; template_name: string; starts_at: string } | null> {
  const tpl = await templateByName(persona.preferredTemplate);
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86_400_000);

  const { data, error } = await admin
    .from("class_instances")
    .select("id, starts_at, template_id, max_capacity, booked_count, class_templates!inner(name)")
    .eq("studio_id", studioId)
    .eq("status", "scheduled")
    .eq("template_id", tpl.id)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;

  // Filter by time bucket + already-booked + capacity.
  const candidates: { id: string; template_name: string; starts_at: string }[] = [];
  for (const row of data ?? []) {
    if (!matchesBucket(row.starts_at, persona.preferredTime, "Europe/Oslo")) continue;
    if ((row.booked_count as number) >= (row.max_capacity as number)) continue;
    candidates.push({
      id: row.id as string,
      template_name: (row.class_templates as any).name,
      starts_at: row.starts_at as string,
    });
  }
  if (candidates.length === 0) return null;

  // Skip classes the user already booked.
  const ids = candidates.map((c) => c.id);
  const { data: existing } = await admin
    .from("bookings")
    .select("class_instance_id")
    .eq("user_id", userId)
    .in("class_instance_id", ids)
    .neq("status", "cancelled");
  const taken = new Set((existing ?? []).map((b) => b.class_instance_id as string));
  const available = candidates.filter((c) => !taken.has(c.id));
  if (available.length === 0) return null;

  // Pick the next one (soonest matching).
  return available[0];
}

function matchesBucket(startsAtIso: string, bucket: TimeBucket, tz: string): boolean {
  const d = new Date(startsAtIso);
  // Convert UTC to studio-local hour. Standard offset, ignores DST drift.
  const offsetMin = tz === "Europe/Oslo" ? 60 : 0;
  const local = new Date(d.getTime() + offsetMin * 60_000);
  const h = local.getUTCHours();
  switch (bucket) {
    case "morning": return h >= 5 && h < 11;
    case "midday":  return h >= 11 && h < 15;
    case "evening": return h >= 15 && h < 24;
  }
}

async function bookAsPersona(email: string, classInstanceId: string): Promise<boolean> {
  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: process.env.TEST_USER_PASSWORD ?? "",
  });
  if (signInErr) {
    console.warn(`  signIn failed for ${email}:`, signInErr.message);
    return false;
  }
  const { data, error } = await client.functions.invoke("create-checkout", {
    body: { class_instance_id: classInstanceId },
  });
  if (error) {
    console.warn(`  create-checkout failed for ${email}:`, error.message);
    return false;
  }
  // free=true → membership-credit path (no Stripe). Anything else means
  // the user has no active credits and Stripe URL was returned — for the
  // daily script we treat that as skipped (don't redirect-script a payment).
  if ((data as any)?.free === true) return true;
  console.log(`  ${email}: no membership credit, would have needed Stripe — skipping`);
  return false;
}

async function findExistingFutureBooking(
  email: string,
  studioId: string,
): Promise<{ bookingId: string } | null> {
  const userId = await findUserId(email);
  if (!userId) return null;
  const { data } = await admin
    .from("bookings")
    .select("id, class_instances!inner(starts_at)")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("class_instances.starts_at", new Date().toISOString())
    .limit(5);
  if (!data || data.length === 0) return null;
  return { bookingId: data[0].id as string };
}

async function cancelAsPersona(email: string, bookingId: string): Promise<boolean> {
  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: process.env.TEST_USER_PASSWORD ?? "",
  });
  if (signInErr) return false;
  const { error } = await client
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId);
  return !error;
}

function humanTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
