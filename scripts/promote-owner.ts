#!/usr/bin/env bun
/**
 * Promote a user to owner of a studio.
 *
 * Use after the customer has signed up via OTP on their site (which creates
 * an auth.users row + auto-upserts a studio_members row with role='member').
 *
 * Usage:
 *   bun run scripts/promote-owner.ts --slug=fooyoga --email=customer@fooyoga.no
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

function parseFlag(argv: string[], name: string): string | undefined {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.split("=", 2)[1];
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const slug = parseFlag(argv, "slug");
  const email = parseFlag(argv, "email");
  if (!slug || !email) {
    console.error("Usage: bun run scripts/promote-owner.ts --slug=<studio-slug> --email=<user-email>");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Look up studio by slug
  const { data: studio, error: studioErr } = await admin
    .from("studios")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (studioErr || !studio) {
    console.error(`Studio with slug "${slug}" not found.`);
    process.exit(1);
  }

  // Look up user by email — paginate so we don't silently miss past 1000.
  // (This is the same brittleness flagged in audit finding #10. Acceptable
  // here because this is a CLI run by a human who can re-invoke if their
  // user is on a deeper page; not a hot path like the invite Edge Function.)
  let userId: string | null = null;
  let page = 1;
  while (page <= 100) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("Failed to list users:", error);
      process.exit(1);
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      userId = found.id;
      break;
    }
    if (data.users.length < 1000) break;
    page++;
  }
  if (!userId) {
    console.error(`User with email "${email}" not found in auth.users.`);
    console.error(`Have they signed up yet on ${slug}?`);
    process.exit(1);
  }

  // Upsert studio_members with role='owner'
  const { error: upsertErr } = await admin
    .from("studio_members")
    .upsert(
      {
        studio_id: studio.id,
        user_id: userId,
        role: "owner",
        is_active: true,
      },
      { onConflict: "studio_id,user_id" },
    );
  if (upsertErr) {
    console.error("Failed to upsert studio_members:", upsertErr);
    process.exit(1);
  }

  console.log(`✓ ${email} is now owner of ${studio.name} (slug: ${slug})`);
  console.log(`  They'll see /manage on next page load (cache may take ~5 min — sign out + back in to bypass).`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
