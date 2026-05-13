// Notify all confirmed/cancelled members when a staff member cancels a class.
// Called from the manager ClassDrawer immediately after cancelling the class instance.
// Deploy with standard JWT auth (no --no-verify-jwt flag needed — staff token is present).
//
// POST body: { class_instance_id: string }
// Returns:   { sent: number, skipped: number }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { esc } from "../_shared/email.ts";
import { validateStudioMatch } from "../_shared/guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  // --- Auth check: must be an authenticated staff request ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const { class_instance_id } = body ?? {};
  if (!class_instance_id) {
    return new Response(JSON.stringify({ error: "class_instance_id is required" }), {
      status: 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Use service-role client so we can read profiles + auth users freely
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify the caller is staff for this studio
  const userJwt = authHeader.slice(7);
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(userJwt);
  if (!caller || callerErr) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    // --- 1. Fetch class instance details ---
    const { data: ci, error: ciErr } = await admin
      .from("class_instances")
      .select(`
        studio_id,
        starts_at,
        ends_at,
        class_templates ( name ),
        instructors ( display_name ),
        locations ( name, timezone )
      `)
      .eq("id", class_instance_id)
      .single();

    if (!ci || ciErr) {
      console.error("class_instance not found:", class_instance_id, ciErr);
      return new Response(JSON.stringify({ error: "Class instance not found" }), {
        status: 404,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const studioId: string = (ci as any).studio_id;

    // Confirm caller is staff for this studio
    const { data: membership } = await admin
      .from("studio_members")
      .select("role")
      .eq("studio_id", studioId)
      .eq("user_id", caller.id)
      .single();

    // Match the studio_role enum: 'owner', 'manager', 'instructor', 'member'.
    // Mirror user_is_staff() — owners, managers, and instructors can dispatch cancellations.
    if (!membership || !["owner", "manager", "instructor"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Cross-tenant guard (after role check: studio_id is DB-derived from class_instance_id) ---
    const guardErr = await validateStudioMatch(req, admin, studioId);
    if (guardErr) return guardErr;

    // --- 2. Fetch studio name + canonical URL + sender email ---
    const { data: studio } = await admin
      .from("studios")
      .select("name, app_url, from_email")
      .eq("id", studioId)
      .single();

    const studioName: string = (studio as any)?.name ?? "Your Studio";
    const studioAppUrl: string =
      (studio as any)?.app_url ?? Deno.env.get("APP_URL") ?? "";
    const studioFromEmail: string = (studio as any)?.from_email ?? FROM_EMAIL;

    // --- 3. Fetch cancelled bookings with member email ---
    const { data: bookings, error: bookErr } = await admin
      .from("bookings")
      .select(`
        id,
        user_id,
        profiles ( full_name, email )
      `)
      .eq("class_instance_id", class_instance_id)
      .eq("status", "cancelled")
      .not("user_id", "is", null);

    if (bookErr) {
      console.error("bookings fetch error:", bookErr);
      return new Response(JSON.stringify({ error: "Failed to fetch bookings" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — skipping cancellation notifications");
      return new Response(JSON.stringify({ sent: 0, skipped: bookings.length }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- 4. Build display strings ---
    const ciAny = ci as any;
    const tz = ciAny.locations?.timezone ?? "Europe/Oslo";
    const startsAt = new Date(ciAny.starts_at);
    const className: string = ciAny.class_templates?.name ?? "Your class";
    const instructorName: string = ciAny.instructors?.display_name ?? "";
    const locationName: string = ciAny.locations?.name ?? "";

    const dateStr = startsAt.toLocaleDateString("nb-NO", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
    });
    const timeStr = startsAt.toLocaleTimeString("nb-NO", {
      hour: "2-digit", minute: "2-digit", timeZone: tz,
    });

    const subject = `${studioName} — ${className} on ${dateStr} has been cancelled`;

    // --- 5. Send one email per booking, idempotently ---
    let sent = 0;
    let skipped = 0;

    for (const booking of bookings) {
      const bookingId: string = (booking as any).id;
      const userId: string = (booking as any).user_id;
      const profile: any = (booking as any).profiles;
      const recipientEmail: string | null = profile?.email ?? null;
      const recipientName: string = profile?.full_name ?? "there";

      if (!recipientEmail) {
        console.warn("No email for booking:", bookingId);
        skipped++;
        continue;
      }

      const idempotencyKey = `cancel_notify_${bookingId}`;

      // Idempotency: INSERT log row before sending — unique constraint is the guard
      const { error: logErr } = await admin.from("notification_log").insert({
        studio_id: studioId,
        user_id: userId,
        channel: "email",
        template: "class_cancellation",
        recipient: recipientEmail,
        idempotency_key: idempotencyKey,
      });

      if (logErr?.code === "23505") {
        // Already sent — skip silently
        skipped++;
        continue;
      }
      if (logErr) {
        console.error("notification_log insert error for booking", bookingId, logErr);
        skipped++;
        continue;
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
      <h2 style="font-size:20px;color:#1a1a18;margin:0 0 8px;">Class cancelled</h2>
      <p style="color:#6b6b63;font-size:15px;margin:0 0 24px;">
        Hi ${esc(recipientName)}, we're sorry to let you know that a class you were booked into has been cancelled.
      </p>

      <div style="background:#f5f0e8;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:15px;color:#1a1a18;"><strong>${esc(className)}</strong></p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b6b63;">${esc(dateStr)} · ${esc(timeStr)}</p>
        ${instructorName ? `<p style="margin:0 0 4px;font-size:13px;color:#6b6b63;">with ${esc(instructorName)}</p>` : ""}
        ${locationName ? `<p style="margin:0;font-size:13px;color:#6b6b63;">📍 ${esc(locationName)}</p>` : ""}
      </div>

      <p style="color:#6b6b63;font-size:14px;line-height:1.6;margin:0 0 24px;">
        We hope to see you again soon — check the schedule for upcoming classes.
      </p>

      <div style="text-align:center;">
        <a href="${esc(studioAppUrl)}"
           style="display:inline-block;background:#1a1a18;color:#f5f0e8;text-decoration:none;padding:14px 32px;border-radius:8px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">
          View schedule →
        </a>
      </div>

      <p style="color:#9b9b93;font-size:12px;text-align:center;margin-top:28px;">
        — ${esc(studioName)}
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
          to: [recipientEmail],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend error for booking", bookingId, errText);
        await admin.from("notification_log")
          .update({ error: errText })
          .eq("idempotency_key", idempotencyKey);
        skipped++;
      } else {
        sent++;
      }
    }

    return new Response(JSON.stringify({ sent, skipped }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cancel-class-notify error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
