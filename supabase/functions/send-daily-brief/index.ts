// Morning brief — fires once per day per studio, sends a plain-language
// summary of relationship moments and nudge-worthy signals to the studio owner.
//
// Cron: 0 7 * * *  (07:00 UTC daily — fine for EU; add per-studio hour before non-EU onboarding)
// Deploy: supabase functions deploy send-daily-brief --project-ref <ref> --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";
import { esc } from "../_shared/email.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY");

// ── Types ─────────────────────────────────────────────────────────────────────

interface Studio {
  id: string;
  name: string;
  timezone: string;
  from_email: string | null;
}

interface FirstTimer   { user_id: string; full_name: string; class_name: string; time_str: string; }
interface Milestone    { user_id: string; full_name: string; total_sessions: number; class_name: string; time_str: string; }
interface Anniversary  { user_id: string; full_name: string; years: number; }
interface Return       { user_id: string; full_name: string; days_away: number; }
interface Referral     { referrer_name: string; referred_name: string; }
interface ClipInactive { user_id: string; full_name: string; credits_remaining: number; }
interface Expiring     { user_id: string; full_name: string; plan_name: string; days_left: number; }
interface FTReturn     { user_id: string; full_name: string; days_ago: number; }

interface Signals {
  firstTimers:   FirstTimer[];
  milestones:    Milestone[];
  anniversaries: Anniversary[];
  returns:       Return[];
  referrals:     Referral[];
  clipInactive:  ClipInactive[];
  expiring:      Expiring[];
  ftReturns:     FTReturn[];
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: studios, error } = await sb
    .from("studios")
    .select("id, name, timezone, from_email")
    .eq("daily_brief_enabled", true)
    .eq("is_active", true);

  if (error) {
    console.error("send-daily-brief: failed to fetch studios:", error.message);
    return new Response("error", { status: 500 });
  }

  for (const studio of (studios ?? []) as Studio[]) {
    try {
      await sendBrief(sb, studio);
    } catch (err) {
      console.error(`send-daily-brief: studio ${studio.id} failed:`, err);
    }
  }

  return new Response("ok");
});

// ── Per-studio ────────────────────────────────────────────────────────────────

async function sendBrief(sb: ReturnType<typeof createClient>, studio: Studio) {
  const tz    = studio.timezone;
  const today = localDateStr(tz); // YYYY-MM-DD in studio's timezone

  // ── Idempotency: skip if brief already sent today ──
  const key = `daily-brief:${studio.id}:${today}`;
  const { error: logErr } = await sb.from("notification_log").insert({
    studio_id:       studio.id,
    channel:         "email",
    template:        "daily_brief",
    recipient:       `studio:${studio.id}`,
    idempotency_key: key,
  });
  if (logErr?.code === "23505") return; // already sent

  // ── Owner email ──
  const { data: ownerRow } = await sb
    .from("studio_members")
    .select("user_id, profiles(email)")
    .eq("studio_id", studio.id)
    .eq("role", "owner")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const ownerEmail = (ownerRow as any)?.profiles?.email as string | undefined;
  if (!ownerEmail) return;

  // ── Gather all signals in parallel ──
  const signals = await gatherSignals(sb, studio.id, tz);

  const hasContent = [
    signals.firstTimers, signals.milestones,
    signals.anniversaries, signals.returns, signals.referrals,
    signals.clipInactive, signals.expiring, signals.ftReturns,
  ].some((arr) => arr.length > 0);

  if (!hasContent) return;

  // ── Record freshness for nudge signals ──
  await upsertFreshness(sb, studio.id, [
    ...signals.clipInactive.map(s => ({ user_id: s.user_id, signal_type: "clip_inactive" })),
    ...signals.expiring    .map(s => ({ user_id: s.user_id, signal_type: "expiring_membership" })),
    ...signals.ftReturns   .map(s => ({ user_id: s.user_id, signal_type: "first_timer_return" })),
  ]);

  // ── Build and send ──
  const html    = buildEmail(studio.name, today, tz, signals);
  const subject = `Your morning brief · ${formatDay(today, tz)}`;
  const from    = studio.from_email ?? Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

  if (!RESEND_API_KEY) {
    console.log(`[dry-run] Would send brief to ${ownerEmail} for ${studio.name}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:     `${esc(studio.name)} · Cami <${from}>`,
      to:       [ownerEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`send-daily-brief: Resend error for ${studio.id}:`, body);
  }
}

// ── Signal queries ────────────────────────────────────────────────────────────

async function gatherSignals(
  sb: ReturnType<typeof createClient>,
  studioId: string,
  tz: string,
): Promise<Signals> {
  // Get recently-surfaced user IDs per nudge signal type (freshness filter)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSignals } = await sb
    .from("brief_signals")
    .select("user_id, signal_type")
    .eq("studio_id", studioId)
    .gte("surfaced_at", cutoff);

  const recentMap: Record<string, Set<string>> = {};
  for (const row of (recentSignals ?? []) as { user_id: string; signal_type: string }[]) {
    (recentMap[row.signal_type] ??= new Set()).add(row.user_id);
  }
  const recentFor = (type: string) => recentMap[type] ?? new Set<string>();

  const [
    { data: ftRaw },
    { data: msRaw },
    { data: retRaw },
    { data: ftRetRaw },
    { data: anniversaryRaw },
    { data: referralRaw },
    { data: clipRaw },
    { data: expRaw },
  ] = await Promise.all([
    sb.rpc("brief_first_timers_today",  { p_studio_id: studioId, p_tz: tz }),
    sb.rpc("brief_milestones_today",    { p_studio_id: studioId, p_tz: tz }),
    sb.rpc("brief_returns_today",       { p_studio_id: studioId, p_tz: tz }),
    sb.rpc("brief_first_timer_returns", { p_studio_id: studioId }),
    // Anniversaries: members whose join date matches today's month+day
    sb.from("studio_members")
      .select("user_id, joined_at, profiles(full_name)")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .eq("role", "member"),
    // Referrals completed in last 7 days
    sb.from("referrals")
      .select("referrer_user_id, referred_user_id, profiles!referrals_referrer_user_id_fkey(full_name), referred:profiles!referrals_referred_user_id_fkey(full_name)")
      .eq("studio_id", studioId)
      .eq("status", "completed")
      .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    // Clip card holders with credits who haven't booked in 21+ days
    sb.from("memberships")
      .select("user_id, credits_remaining, products!inner(type), profiles(full_name, email, phone_number)")
      .eq("studio_id", studioId)
      .eq("status", "active")
      .eq("products.type", "clip_card")
      .gt("credits_remaining", 0),
    // Memberships expiring in 7 days with no auto-renew
    sb.from("memberships")
      .select("user_id, valid_until, credits_remaining, products(name, type), profiles(full_name, email, phone_number)")
      .eq("studio_id", studioId)
      .eq("status", "active")
      .is("provider_subscription_id", null)
      .lte("valid_until", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .gte("valid_until", new Date().toISOString().split("T")[0]),
  ]);

  // ── Process anniversaries (filter in JS — month+day match) ──
  const todayMD = localDateStr(tz).slice(5); // "MM-DD"
  const anniversaries: Anniversary[] = ((anniversaryRaw ?? []) as any[])
    .filter((r) => {
      const joinedMD = r.joined_at?.slice(5, 10);
      return joinedMD === todayMD && r.joined_at?.slice(0, 10) !== localDateStr(tz);
    })
    .map((r) => ({
      user_id:    r.user_id,
      full_name:  r.profiles?.full_name ?? "Someone",
      years:      new Date().getFullYear() - new Date(r.joined_at).getFullYear(),
    }));

  // ── Referrals ──
  const referrals: Referral[] = ((referralRaw ?? []) as any[]).map((r) => ({
    referrer_name: r.profiles?.full_name ?? "A member",
    referred_name: r.referred?.full_name ?? "someone",
  }));

  // ── Clip inactive: filter by freshness + require contact info ──
  // Need last_booking_at — fetch from bookings
  const clipUserIds = ((clipRaw ?? []) as any[]).map((r) => r.user_id);
  const lastBookingMap: Record<string, string> = {};
  if (clipUserIds.length > 0) {
    const { data: lbData } = await sb
      .from("bookings")
      .select("user_id, booked_at")
      .eq("studio_id", studioId)
      .eq("status", "confirmed")
      .in("user_id", clipUserIds)
      .order("booked_at", { ascending: false });
    for (const row of (lbData ?? []) as { user_id: string; booked_at: string }[]) {
      if (!lastBookingMap[row.user_id]) lastBookingMap[row.user_id] = row.booked_at;
    }
  }

  const clipInactive: ClipInactive[] = ((clipRaw ?? []) as any[])
    .filter((r) => {
      if (recentFor("clip_inactive").has(r.user_id)) return false;
      if (!r.profiles?.email && !r.profiles?.phone_number) return false;
      const last = lastBookingMap[r.user_id];
      if (!last) return true; // never booked at all
      return Date.now() - new Date(last).getTime() > 21 * 24 * 60 * 60 * 1000;
    })
    .map((r) => ({
      user_id:          r.user_id,
      full_name:        r.profiles?.full_name ?? "Someone",
      credits_remaining: r.credits_remaining,
    }));

  // ── Expiring memberships: filter by freshness + require contact info ──
  const expiring: Expiring[] = ((expRaw ?? []) as any[])
    .filter((r) => {
      if (recentFor("expiring_membership").has(r.user_id)) return false;
      return r.profiles?.email || r.profiles?.phone_number;
    })
    .map((r) => ({
      user_id:   r.user_id,
      full_name: r.profiles?.full_name ?? "Someone",
      plan_name: r.products?.name ?? "membership",
      days_left: Math.ceil(
        (new Date(r.valid_until).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      ),
    }));

  // ── First-timer returns: filter by freshness ──
  const ftReturns: FTReturn[] = ((ftRetRaw ?? []) as any[])
    .filter((r) => !recentFor("first_timer_return").has(r.user_id))
    .map((r) => ({
      user_id:   r.user_id,
      full_name: r.full_name,
      days_ago:  r.days_ago,
    }));

  return {
    firstTimers:   (ftRaw  ?? []) as FirstTimer[],
    milestones:    (msRaw  ?? []) as Milestone[],
    anniversaries,
    returns:       (retRaw ?? []) as Return[],
    referrals,
    clipInactive,
    expiring,
    ftReturns,
  };
}

// ── Freshness upsert ──────────────────────────────────────────────────────────

async function upsertFreshness(
  sb: ReturnType<typeof createClient>,
  studioId: string,
  rows: { user_id: string; signal_type: string }[],
) {
  if (rows.length === 0) return;
  await sb.from("brief_signals").upsert(
    rows.map((r) => ({
      studio_id:   studioId,
      user_id:     r.user_id,
      signal_type: r.signal_type,
      surfaced_at: new Date().toISOString(),
    })),
    { onConflict: "studio_id,user_id,signal_type" },
  );
}

// ── Email template ────────────────────────────────────────────────────────────

function buildEmail(
  studioName: string,
  today: string,
  tz: string,
  s: Signals,
): string {
  const todaySection   = buildTodaySection(s);
  const thisWeekSection = buildThisWeekSection(s);
  const nudgeSection   = buildNudgeSection(s);

  const sections = [todaySection, thisWeekSection, nudgeSection]
    .filter(Boolean)
    .join(sectionDivider());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:32px 0 48px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:100%;background:#faf8f5;border-radius:12px;overflow:hidden;border:1px solid #e8e0d5;">

        <!-- Header -->
        <tr><td style="padding:28px 36px 20px;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.13em;text-transform:uppercase;color:#b0a090;font-family:sans-serif;">${esc(studioName)}</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1611;line-height:1.2;">${formatDay(today, tz)}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:0 36px 32px;">
          ${sections}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 36px 28px;border-top:1px solid #ede8e0;">
          <p style="margin:0;font-size:12px;color:#b0a090;font-family:sans-serif;line-height:1.5;">
            Your morning brief from Cami.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildTodaySection(s: Signals): string {
  const lines: string[] = [];

  for (const ft of s.firstTimers) {
    lines.push(`${esc(firstName(ft.full_name))} is coming to their very first class — ${esc(ft.time_str)} ${esc(ft.class_name)}.`);
  }

  for (const ms of s.milestones) {
    lines.push(`${esc(firstName(ms.full_name))} is hitting their ${ordinal(ms.total_sessions)} class today — ${esc(ms.time_str)} ${esc(ms.class_name)}.`);
  }

  if (lines.length === 0) return "";
  return section("Today", lines);
}

function buildThisWeekSection(s: Signals): string {
  const lines: string[] = [];

  for (const a of s.anniversaries) {
    const label = a.years === 1 ? "one year" : `${a.years} years`;
    lines.push(`${esc(firstName(a.full_name))} joined ${label} ago today.`);
  }

  for (const r of s.returns) {
    const weeks = Math.round(r.days_away / 7);
    lines.push(`${esc(firstName(r.full_name))} is back after ${weeks} week${weeks === 1 ? "" : "s"} away.`);
  }

  for (const ref of s.referrals) {
    lines.push(`${esc(firstName(ref.referrer_name))} referred ${esc(firstName(ref.referred_name))}, who just completed their first booking.`);
  }

  if (lines.length === 0) return "";
  return section("This week", lines);
}

function buildNudgeSection(s: Signals): string {
  const lines: string[] = [];

  for (const c of s.clipInactive) {
    const credits = c.credits_remaining;
    lines.push(`${esc(firstName(c.full_name))}: ${credits} credit${credits === 1 ? "" : "s"} left on their clip card, hasn't booked in 3 weeks.`);
  }

  for (const e of s.expiring) {
    lines.push(`${esc(firstName(e.full_name))}'s ${esc(e.plan_name)} expires in ${e.days_left} day${e.days_left === 1 ? "" : "s"}.`);
  }

  for (const ft of s.ftReturns) {
    lines.push(`${esc(firstName(ft.full_name))} came for the first time ${ft.days_ago} days ago and hasn't booked again.`);
  }

  if (lines.length === 0) return "";
  return section("Worth a nudge", lines);
}

function section(title: string, lines: string[]): string {
  const items = lines.map(
    (l) => `<li style="margin:0 0 10px;font-size:15px;color:#2a2420;line-height:1.5;">${l}</li>`
  ).join("\n          ");

  return `<div style="margin-top:24px;">
    <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.11em;text-transform:uppercase;color:#b0a090;font-family:sans-serif;">${esc(title)}</p>
    <ul style="margin:0;padding:0 0 0 16px;">
      ${items}
    </ul>
  </div>`;
}

function sectionDivider(): string {
  return `<div style="margin:20px 0;height:1px;background:#ede8e0;"></div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz }); // YYYY-MM-DD
}

function formatDay(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function firstName(fullName: string): string {
  return fullName?.split(" ")[0] ?? fullName ?? "Someone";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
