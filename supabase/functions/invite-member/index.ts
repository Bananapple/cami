import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const APP_URL = Deno.env.get("APP_URL") ?? "https://brie-alpha.vercel.app";

// Valid studio_role values — must match the DB enum
const VALID_ROLES = ["owner", "manager", "instructor", "member"] as const;
type StudioRole = typeof VALID_ROLES[number];

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

  try {
    // --- Auth: require a valid Supabase JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header" }, 401);
    }
    const jwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse body ---
    // Accepts { user_id, studio_id } or { email, studio_id, full_name?, role? }
    // role defaults to 'member'; use 'manager' or 'instructor' for staff invites
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const {
      user_id,
      email: emailInput,
      full_name: nameInput,
      studio_id,
      role: roleInput,
    } = body ?? {};

    if (!studio_id) return json({ error: "studio_id is required" }, 400);
    if (!user_id && !emailInput) return json({ error: "user_id or email is required" }, 400);

    // Validate role — default to 'member'
    const memberRole: StudioRole =
      roleInput && VALID_ROLES.includes(roleInput) ? roleInput : "member";

    // --- Auth check: caller must be owner or manager ---
    const { data: callerMember } = await admin
      .from("studio_members")
      .select("role")
      .eq("studio_id", studio_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "manager"])
      .maybeSingle();

    if (!callerMember) return json({ error: "Forbidden" }, 403);

    // --- Resolve member email + name ---
    let memberEmail: string;
    let memberName: string;
    let resolvedUserId: string | null = user_id ?? null;

    if (user_id) {
      // Lookup by user_id — must exist as a studio member
      const { data: memberRow } = await admin
        .from("studio_members")
        .select("user_id, profiles ( full_name )")
        .eq("studio_id", studio_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (!memberRow) return json({ error: "Member not found in this studio" }, 404);

      const { data: { user: memberAuthUser } } = await admin.auth.admin.getUserById(user_id);
      if (!memberAuthUser?.email) return json({ error: "Member has no email address" }, 422);

      memberEmail = memberAuthUser.email;
      memberName = (memberRow.profiles as any)?.full_name ?? nameInput ?? memberEmail;
    } else {
      // Lookup by email — user may not exist yet (prospective invite)
      memberEmail = emailInput.trim();
      memberName = nameInput?.trim() ?? memberEmail;

      // Try to find existing auth user by email
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users?.find((u: any) => u.email === memberEmail);
      resolvedUserId = existing?.id ?? null;
    }

    // --- Upsert studio_members row with the correct role ---
    // Do this before sending the email so the role is set even if email fails.
    if (resolvedUserId) {
      const { error: upsertErr } = await admin
        .from("studio_members")
        .upsert(
          {
            studio_id,
            user_id: resolvedUserId,
            role: memberRole,
            is_active: true,
          },
          { onConflict: "studio_id,user_id" }
        );
      if (upsertErr) {
        console.error("studio_members upsert error:", upsertErr);
        // Non-fatal: continue to send the email
      }
    }
    // If the user doesn't exist yet, the studio_members row will be created
    // when they sign up via the auth trigger (or on first booking for members).

    // --- Fetch studio name ---
    const { data: studio } = await admin
      .from("studios")
      .select("name, slug")
      .eq("id", studio_id)
      .single();

    const studioName = (studio as any)?.name ?? "Your Studio";

    // --- Idempotency: log before sending ---
    const idempotencyKey = resolvedUserId
      ? `invite_${memberRole}_${resolvedUserId}_${studio_id}`
      : `invite_email_${memberEmail}_${studio_id}`;

    const { error: logErr } = await admin.from("notification_log").insert({
      studio_id,
      user_id: resolvedUserId,
      channel: "email",
      template: "member_invite",
      recipient: memberEmail,
      idempotency_key: idempotencyKey,
    });

    if (logErr?.code === "23505") {
      return json({ sent: true });
    }
    if (logErr) {
      console.error("notification_log insert error:", logErr);
      return json({ error: "Failed to log notification" }, 500);
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — skipping invite email");
      return json({ sent: false });
    }

    // --- Email copy varies by role ---
    const isStaffInvite = memberRole === "manager" || memberRole === "instructor";
    const manageUrl = `${APP_URL}/manage`;

    const html = isStaffInvite ? `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;background:#fafaf8;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e3;">
    <div style="background:#1a1a18;padding:32px 40px;">
      <h1 style="color:#f5f0e8;font-size:22px;margin:0;letter-spacing:0.02em;">${studioName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="font-size:20px;color:#1a1a18;margin:0 0 8px;">You've been added as ${memberRole === "manager" ? "a manager" : "an instructor"}</h2>
      <p style="color:#6b6b63;font-size:15px;margin:0 0 24px;">
        Hi ${memberName}, you now have staff access to <strong>${studioName}</strong>.
      </p>
      <div style="margin-bottom:24px;text-align:center;">
        <a href="${manageUrl}"
           style="display:inline-block;background:#1a1a18;color:#f5f0e8;text-decoration:none;padding:14px 32px;border-radius:8px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">
          Open studio dashboard →
        </a>
      </div>
      <p style="color:#6b6b63;font-size:14px;margin:0 0 8px;">
        Sign in with your email — no password needed.
      </p>
    </div>
  </div>
</body>
</html>` : `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;background:#fafaf8;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e3;">
    <div style="background:#1a1a18;padding:32px 40px;">
      <h1 style="color:#f5f0e8;font-size:22px;margin:0;letter-spacing:0.02em;">${studioName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="font-size:20px;color:#1a1a18;margin:0 0 8px;">Welcome to ${studioName}</h2>
      <p style="color:#6b6b63;font-size:15px;margin:0 0 24px;">
        Hi ${memberName}, you've been added as a member of <strong>${studioName}</strong>.
      </p>
      <div style="margin-bottom:24px;text-align:center;">
        <a href="${APP_URL}"
           style="display:inline-block;background:#1a1a18;color:#f5f0e8;text-decoration:none;padding:14px 32px;border-radius:8px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">
          Book a class →
        </a>
      </div>
      <p style="color:#6b6b63;font-size:14px;margin:0 0 8px;">
        Just enter your email to receive a login code — no password needed.
      </p>
      <p style="color:#9b9b93;font-size:13px;margin:24px 0 0;font-style:italic;">
        See you on the mat!
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
        subject: isStaffInvite
          ? `You've been added to ${studioName}`
          : `Welcome to ${studioName}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      await admin
        .from("notification_log")
        .update({ error: errText })
        .eq("idempotency_key", idempotencyKey);
      return json({ sent: false, error: "Email delivery failed" }, 502);
    }

    return json({ sent: true });
  } catch (err) {
    console.error("invite-member error:", err);
    return json({ error: `Internal server error: ${err}` }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
