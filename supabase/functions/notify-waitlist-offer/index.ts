// Called by a Supabase Database Webhook on waitlists UPDATE where status = 'offered'.
// Deploy with --no-verify-jwt (the webhook sends no user JWT).
// Set WEBHOOK_SECRET secret and add `Authorization: Bearer <secret>` header in the DB webhook config.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { esc } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

Deno.serve(async (req) => {
  // Verify the request comes from our Supabase DB webhook, not arbitrary callers.
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Supabase DB webhook payload shape: { type, table, record, old_record, schema }
  const { type, record, old_record } = body;

  if (type !== "UPDATE") return new Response("OK", { status: 200 });

  // Only act when status transitions to 'offered'
  if (record?.status !== "offered" || old_record?.status === "offered") {
    return new Response("OK", { status: 200 });
  }

  const waitlistId: string = record.id;
  const classInstanceId: string = record.class_instance_id;
  const userId: string = record.user_id;
  const studioId: string = record.studio_id;
  const offerExpiresAt: string | null = record.offer_expires_at;

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping waitlist notification");
    return new Response("OK", { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Fetch class details
    const { data: ci, error: ciErr } = await admin
      .from("class_instances")
      .select(`
        starts_at,
        class_templates ( name, default_duration_minutes ),
        instructors ( display_name ),
        locations ( name, timezone )
      `)
      .eq("id", classInstanceId)
      .single();

    if (!ci) {
      console.error("class_instance not found:", classInstanceId, ciErr);
      return new Response("OK", { status: 200 });
    }

    // Fetch user email + studio name + canonical URL + sender email in parallel
    const [{ data: { user } }, { data: studio }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("studios").select("name, app_url, from_email").eq("id", studioId).single(),
    ]);

    if (!user?.email) {
      console.error("No email for user:", userId);
      return new Response("OK", { status: 200 });
    }

    const studioName = (studio as any)?.name ?? "Your Studio";
    const studioAppUrl: string =
      (studio as any)?.app_url ?? Deno.env.get("APP_URL") ?? "";
    const studioFromEmail: string = (studio as any)?.from_email ?? FROM_EMAIL;
    const idempotencyKey = `waitlist_offer_${waitlistId}`;

    // Idempotency: INSERT log row before sending — unique constraint is the lock
    const { error: logErr } = await admin.from("notification_log").insert({
      studio_id: studioId,
      user_id: userId,
      channel: "email",
      template: "waitlist_offer",
      recipient: user.email,
      idempotency_key: idempotencyKey,
    });

    if (logErr?.code === "23505") { return new Response("OK", { status: 200 }); }
    if (logErr) {
      console.error("notification_log insert error:", logErr);
      return new Response("OK", { status: 200 });
    }

    const ciAny = ci as any;
    const startsAt = new Date(ciAny.starts_at);
    const tz = ciAny.locations?.timezone ?? "Europe/Oslo";
    const className = ciAny.class_templates?.name ?? "Your class";
    const instructor = ciAny.instructors?.display_name ?? "";
    const location = ciAny.locations?.name ?? "";
    const duration = ciAny.class_templates?.default_duration_minutes ?? 60;

    const dateStr = startsAt.toLocaleDateString("nb-NO", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
    });
    const timeStr = startsAt.toLocaleTimeString("nb-NO", {
      hour: "2-digit", minute: "2-digit", timeZone: tz,
    });

    let expiryLine = "";
    if (offerExpiresAt) {
      const expires = new Date(offerExpiresAt);
      const expiryStr = expires.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      expiryLine = `<p style="color:#b45309;font-size:14px;margin-top:8px;">⏰ This spot is held for you until <strong>${esc(expiryStr)}</strong>. After that it passes to the next person on the list.</p>`;
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;background:#fafaf8;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e3;">
    <div style="background:#1a1a18;padding:32px 40px;">
      <h1 style="color:#f5f0e8;font-size:22px;margin:0;letter-spacing:0.02em;">${esc(studioName)}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="font-size:20px;color:#1a1a18;margin:0 0 8px;">A spot just opened up</h2>
      <p style="color:#6b6b63;font-size:15px;margin:0 0 24px;">Good news — someone cancelled and you're next in line for <strong>${esc(className)}</strong>.</p>

      <div style="background:#f5f0e8;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:15px;color:#1a1a18;"><strong>${esc(className)}</strong></p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b6b63;">${esc(dateStr)} · ${esc(timeStr)}</p>
        ${instructor ? `<p style="margin:0 0 4px;font-size:13px;color:#6b6b63;">with ${esc(instructor)}</p>` : ""}
        ${location ? `<p style="margin:0;font-size:13px;color:#6b6b63;">📍 ${esc(location)}</p>` : ""}
      </div>

      ${expiryLine}

      <div style="margin-top:28px;text-align:center;">
        <a href="${esc(studioAppUrl)}/dashboard"
           style="display:inline-block;background:#1a1a18;color:#f5f0e8;text-decoration:none;padding:14px 32px;border-radius:8px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">
          Book your spot →
        </a>
      </div>

      <p style="color:#9b9b93;font-size:12px;text-align:center;margin-top:28px;">
        Don't want this spot? You can leave the waitlist from your dashboard.
      </p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      signal: AbortSignal.timeout(10000),
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: studioFromEmail,
        to: [user.email],
        subject: `Spot available — ${className} on ${dateStr}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      await admin.from("notification_log")
        .update({ error: errText })
        .eq("idempotency_key", idempotencyKey);
    }
  } catch (err) {
    console.error("notify-waitlist-offer error:", err);
  }

  return new Response("OK", { status: 200 });
});
