// Send a one-off message from a studio manager to a member.
// Requires a valid staff JWT. Deploy without --no-verify-jwt.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-studio-slug",
        "Access-Control-Allow-Methods": "POST",
      },
    });
  }

  // --- Auth: require a valid staff JWT ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing authorization header" }, 401);
  }
  const jwt = authHeader.slice(7);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Parse body ---
  let body: { user_id: string; studio_id: string; subject: string; body: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { user_id, studio_id, subject, body: messageBody } = body;
  if (!user_id || !studio_id || !subject?.trim() || !messageBody?.trim()) {
    return json({ error: "user_id, studio_id, subject, and body are required" }, 400);
  }

  // --- Verify caller is staff for this studio ---
  const { data: callerMembership, error: memberErr } = await admin
    .from("studio_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("studio_id", studio_id)
    .single();

  if (memberErr || !callerMembership) {
    return json({ error: "Forbidden — not a member of this studio" }, 403);
  }
  if (!["owner", "manager"].includes(callerMembership.role)) {
    return json({ error: "Forbidden — manager role required" }, 403);
  }

  // --- Fetch member email + name, and studio name in parallel ---
  const [profileResult, studioResult] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", user_id).single(),
    admin.from("studios").select("name").eq("id", studio_id).single(),
  ]);

  const memberEmail = (profileResult.data as any)?.email;
  const memberName = (profileResult.data as any)?.full_name ?? "Member";
  const studioName = (studioResult.data as any)?.name ?? "Your Studio";

  if (!memberEmail) {
    // Fall back to auth.users if profiles doesn't store email
    const { data: { user: memberUser } } = await admin.auth.admin.getUserById(user_id);
    if (!memberUser?.email) {
      return json({ error: "Could not resolve member email" }, 404);
    }
    // proceed with memberUser.email below
    return await sendMessage({
      admin,
      studio_id,
      user_id,
      studioName,
      memberName,
      memberEmail: memberUser.email,
      subject,
      messageBody,
    });
  }

  return await sendMessage({
    admin,
    studio_id,
    user_id,
    studioName,
    memberName,
    memberEmail,
    subject,
    messageBody,
  });
});

async function sendMessage({
  admin,
  studio_id,
  user_id,
  studioName,
  memberName,
  memberEmail,
  subject,
  messageBody,
}: {
  admin: ReturnType<typeof createClient>;
  studio_id: string;
  user_id: string;
  studioName: string;
  memberName: string;
  memberEmail: string;
  subject: string;
  messageBody: string;
}) {
  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping send");
    return json({ sent: false, error: "Email not configured" }, 500);
  }

  // Idempotency key: prevents double-send within the same second on retry
  const idempotencyKey = `msg_${user_id}_${Date.now()}`;

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
    return json({ sent: true });
  }
  if (logErr) {
    console.error("notification_log insert error:", logErr);
    return json({ error: "Failed to log notification" }, 500);
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
      <h1 style="color:#f5f0e8;font-size:22px;margin:0;letter-spacing:0.02em;">${studioName}</h1>
    </div>
    <div style="padding:40px;">
      <p style="color:#1a1a18;font-size:15px;line-height:1.7;margin:0;">Hi ${memberName},</p>
      <div style="color:#1a1a18;font-size:15px;line-height:1.7;margin:20px 0;">${escapedBody}</div>
      <p style="color:#9b9b93;font-size:12px;margin-top:32px;">
        This message was sent to you by ${studioName}.
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
      from: FROM_EMAIL,
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
    return json({ error: `Resend: ${errText}` }, 502);
  }

  return json({ sent: true });
}
