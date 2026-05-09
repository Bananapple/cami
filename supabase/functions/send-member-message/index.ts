// Send a one-off message from a studio manager to a member.
// Requires a valid staff JWT. Deploy without --no-verify-jwt.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // --- Auth: require a valid staff JWT ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, { error: "Missing authorization header" }, 401);
  }
  const jwt = authHeader.slice(7);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json(req, { error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Parse body ---
  let body: { user_id: string; studio_id: string; subject: string; body: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON" }, 400);
  }

  const { user_id, studio_id, subject, body: messageBody } = body;
  if (!user_id || !studio_id || !subject?.trim() || !messageBody?.trim()) {
    return json(req, { error: "user_id, studio_id, subject, and body are required" }, 400);
  }

  // --- Verify caller is staff for this studio ---
  const { data: callerMembership, error: memberErr } = await admin
    .from("studio_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("studio_id", studio_id)
    .single();

  if (memberErr || !callerMembership) {
    return json(req, { error: "Forbidden — not a member of this studio" }, 403);
  }
  if (!["owner", "manager"].includes(callerMembership.role)) {
    return json(req, { error: "Forbidden — manager role required" }, 403);
  }

  // --- Verify the target is actually a member of this studio ---
  // Without this, a manager of Studio A could send branded emails to any user
  // in the database (including members of competing studios) by passing their
  // user_id. RLS doesn't help here because we use the service-role admin client.
  const { data: targetMembership } = await admin
    .from("studio_members")
    .select("user_id")
    .eq("studio_id", studio_id)
    .eq("user_id", user_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!targetMembership) {
    return json(req, { error: "Recipient is not a member of this studio" }, 404);
  }

  // --- Fetch member email + name, and studio name + sender email in parallel ---
  const [profileResult, studioResult] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", user_id).single(),
    admin.from("studios").select("name, from_email").eq("id", studio_id).single(),
  ]);

  const memberEmail = (profileResult.data as any)?.email;
  const memberName = (profileResult.data as any)?.full_name ?? "Member";
  const studioName = (studioResult.data as any)?.name ?? "Your Studio";
  const studioFromEmail: string = (studioResult.data as any)?.from_email ?? FROM_EMAIL;

  if (!memberEmail) {
    // Fall back to auth.users if profiles doesn't store email
    const { data: { user: memberUser } } = await admin.auth.admin.getUserById(user_id);
    if (!memberUser?.email) {
      return json(req, { error: "Could not resolve member email" }, 404);
    }
    // proceed with memberUser.email below
    return await sendMessage({
      req,
      admin,
      studio_id,
      user_id,
      studioName,
      studioFromEmail,
      memberName,
      memberEmail: memberUser.email,
      subject,
      messageBody,
    });
  }

  return await sendMessage({
    req,
    admin,
    studio_id,
    user_id,
    studioName,
    studioFromEmail,
    memberName,
    memberEmail,
    subject,
    messageBody,
  });
});

async function sendMessage({
  req,
  admin,
  studio_id,
  user_id,
  studioName,
  studioFromEmail,
  memberName,
  memberEmail,
  subject,
  messageBody,
}: {
  req: Request;
  admin: ReturnType<typeof createClient>;
  studio_id: string;
  user_id: string;
  studioName: string;
  studioFromEmail: string;
  memberName: string;
  memberEmail: string;
  subject: string;
  messageBody: string;
}) {
  // Inner json() removed — uses outer module-scope json() which is CORS-aware.

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping send");
    return json(req, { sent: false, error: "Email not configured" }, 500);
  }

  // Idempotency key: hash of (subject + body) so an exact re-submission
  // (double-click, network retry) collides on the unique constraint and
  // skips. Different messages to the same user get different keys and send.
  // Old impl used Date.now() which made every call unique — defeating the
  // purpose of the idempotency log.
  const contentBytes = new TextEncoder().encode(`${subject}\n\n${messageBody}`);
  const hashBuf = await crypto.subtle.digest("SHA-256", contentBytes);
  const contentHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const idempotencyKey = `msg_${studio_id}_${user_id}_${contentHash}`;

  const { error: logErr } = await admin.from("notification_log").insert({
    studio_id,
    user_id,
    channel: "email",
    template: "staff_message",
    recipient: memberEmail,
    idempotency_key: idempotencyKey,
  });

  if (logErr?.code === "23505") {
    // Duplicate within the same millisecond — skip silently
    return json(req, { sent: true });
  }
  if (logErr) {
    console.error("notification_log insert error:", logErr);
    return json(req, { error: "Failed to log notification" }, 500);
  }

  // Plain-text email body rendered into a minimal HTML wrapper
  const escapedBody = messageBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

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
      <p style="color:#1a1a18;font-size:15px;line-height:1.7;margin:0;">Hi ${esc(memberName)},</p>
      <div style="color:#1a1a18;font-size:15px;line-height:1.7;margin:20px 0;">${escapedBody}</div>
      <p style="color:#9b9b93;font-size:12px;margin-top:32px;">
        This message was sent to you by ${esc(studioName)}.
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
      to: [memberEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error:", errText);
    await admin.from("notification_log")
      .update({ error: errText })
      .eq("idempotency_key", idempotencyKey);
    return json(req, { error: `Resend: ${errText}` }, 502);
  }

  return json(req, { sent: true });
}
