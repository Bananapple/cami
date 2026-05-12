#!/usr/bin/env bun
/**
 * One-shot seed for the audience-model test studio.
 *
 * Creates 15 test users, gives them memberships per persona spec, backfills
 * historical bookings (up to ~120 days back) so every lifecycle bucket,
 * frequency tier, time affinity, source attribution, and risk flag in the
 * audience model has populated data.
 *
 * Idempotent: re-runnable. Existing users are reused. Existing memberships
 * are upserted. Bookings that already exist (UNIQUE on user_id +
 * class_instance_id) are silently skipped.
 *
 * Usage:
 *   bun run scripts/seed/setup.ts                # populate the configured studio
 *   bun run scripts/seed/setup.ts --dry-run      # log plan, write nothing
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEST_USER_PASSWORD
 *   TEST_STUDIO_SLUG             (optional, defaults to "brie-demo")
 */

import {
  TEST_STUDIO_SLUG,
  admin,
  daysAgoIso,
  ensureMembership,
  ensureStudioMember,
  ensureUser,
  getStudio,
  insertBooking,
  insertPastClassInstance,
} from "./lib";
import { PERSONAS } from "./personas";

const DRY_RUN = process.argv.includes("--dry-run");
// --force: nuke existing seed class_instances + bookings for each persona
// before backfilling. Without this flag, personas that already have any
// confirmed bookings are skipped (true idempotent re-run, no duplication).
const FORCE = process.argv.includes("--force");

async function main() {
  console.log(`\n=== seed/setup → ${TEST_STUDIO_SLUG} ===`);
  if (DRY_RUN) console.log("(dry-run: nothing will be written)");

  const studio = await getStudio();
  console.log(`Studio: ${TEST_STUDIO_SLUG} (${studio.id}) tz=${studio.timezone}`);

  let createdUsers = 0;
  let totalBookings = 0;
  let totalInstances = 0;

  for (const persona of PERSONAS) {
    console.log(`\n• ${persona.id} — ${persona.fullName} <${persona.email}>`);
    if (DRY_RUN) {
      console.log(`  would create user + ${persona.plan ? "membership (" + persona.plan.type + ")" : "no plan"} + ${persona.history.totalBookings} bookings`);
      continue;
    }

    const { userId, created } = await ensureUser(persona);
    if (created) createdUsers += 1;
    console.log(`  user ${userId} (${created ? "created" : "existing"})`);

    await ensureStudioMember(persona, userId);
    const membershipId = await ensureMembership(persona, userId);
    console.log(`  studio_member upserted, membership=${membershipId ?? "—"}`);

    // Idempotency guard: skip backfill if the user already has any confirmed
    // bookings, unless --force was passed. Without this guard, each re-run
    // would create a new set of class_instances (fresh UUIDs) and double
    // the booking history — which breaks personas like one_timer.
    const { count: existingBookings } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studio.id)
      .eq("user_id", userId)
      .eq("status", "confirmed");

    if ((existingBookings ?? 0) > 0 && !FORCE) {
      console.log(`  history: ${existingBookings} existing bookings — skipping (pass --force to rebuild)`);
      continue;
    }

    if (FORCE && (existingBookings ?? 0) > 0) {
      console.log(`  --force: wiping ${existingBookings} existing seed bookings + their class_instances…`);
      // Delete bookings first (FK on class_instance_id).
      await admin
        .from("bookings")
        .delete()
        .eq("studio_id", studio.id)
        .eq("user_id", userId)
        .eq("status", "confirmed");
      // Delete class_instances that were [seed]-tagged for this user. We can't
      // filter by user_id directly (class_instances aren't user-scoped); we
      // rely on the [seed] notes marker and the fact that booked_count would
      // now be 0 since we just deleted the bookings.
      await admin
        .from("class_instances")
        .delete()
        .eq("studio_id", studio.id)
        .eq("notes", "[seed] backfilled for audience-model test data")
        .eq("booked_count", 0);
    }

    // Backfill historical bookings.
    const { totalBookings: count, oldestDaysAgo, newestDaysAgo, oneTimer } = persona.history;
    if (count === 0) {
      console.log(`  history: none (new persona, 0 bookings)`);
      continue;
    }

    // Distribute `count` bookings between newest and oldest days-ago.
    const dates = oneTimer
      ? [newestDaysAgo]
      : evenlyDistributed(count, newestDaysAgo, oldestDaysAgo);

    let booked = 0;
    for (const daysAgo of dates) {
      try {
        const instanceId = await insertPastClassInstance({
          templateName: persona.preferredTemplate,
          time: persona.preferredTime,
          daysAgo,
        });
        totalInstances += 1;

        // For Gio (late-evening persona), override starts_at to 21:30 on the instance.
        if (persona.id === "gio") {
          await admin
            .from("class_instances")
            .update({ starts_at: synthLateEveningIso(daysAgo, studio.timezone) })
            .eq("id", instanceId);
        }

        const result = await insertBooking({
          studioId: studio.id,
          userId,
          classInstanceId: instanceId,
          status: "confirmed",
          bookedAt: daysAgoIso(daysAgo),
          membershipId,
        });
        if (result === "ok") {
          booked += 1;
          totalBookings += 1;
        }
      } catch (e) {
        console.warn(`  ⚠ backfill booking failed (daysAgo=${daysAgo}):`, (e as Error).message);
      }
    }
    console.log(`  history: ${booked}/${count} bookings backfilled (${dates.length} days spread)`);
  }

  // Sync studio_members.total_sessions for each persona from their confirmed
  // booking count. The view's last_booking_at column is derived live; only
  // total_sessions needs the writeback so segments like one_timer / lapsing /
  // inactive (which gate on total_sessions thresholds) classify correctly.
  if (!DRY_RUN) {
    console.log(`\nSyncing studio_members.total_sessions…`);
    for (const persona of PERSONAS) {
      const userId = await getUserIdByEmail(persona.email);
      if (!userId) continue;
      const { count } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio.id)
        .eq("status", "confirmed")
        .eq("user_id", userId);
      await admin
        .from("studio_members")
        .update({ total_sessions: count ?? 0 })
        .eq("studio_id", studio.id)
        .eq("user_id", userId);
    }
  }

  console.log(`\n=== summary ===`);
  console.log(`Personas:        ${PERSONAS.length}`);
  console.log(`Users created:   ${createdUsers}`);
  console.log(`Class instances: ${totalInstances} backfilled`);
  console.log(`Bookings:        ${totalBookings} backfilled`);
  console.log(`Studio:          ${TEST_STUDIO_SLUG}`);
  console.log(`Done.\n`);
}

function evenlyDistributed(count: number, newestDays: number, oldestDays: number): number[] {
  if (count === 1) return [newestDays];
  const step = (oldestDays - newestDays) / (count - 1);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round(newestDays + step * i));
  }
  return out;
}

function synthLateEveningIso(daysAgo: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(21, 30, 0, 0);
  // Subtract studio offset to convert local→UTC.
  const offsetMin = tz === "Europe/Oslo" ? 60 : 0;
  return new Date(d.getTime() - offsetMin * 60_000).toISOString();
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users.find((u) => u.email === email)?.id ?? null;
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
