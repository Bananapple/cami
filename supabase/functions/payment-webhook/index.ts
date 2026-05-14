// Public endpoint — no JWT auth. Signature verification is done by each provider adapter.
// URL pattern: /functions/v1/payment-webhook/stripe  (provider name as last path segment)
//

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";
import type { PaymentProvider } from "../_shared/providers/types.ts";
import { esc, buildConfirmationEmail } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

Deno.serve(async (req) => {
  // Extract provider from the last path segment
  const url = new URL(req.url);
  const provider = url.pathname.split("/").at(-1) as PaymentProvider | undefined;

  if (!provider) return new Response("Missing provider", { status: 400 });

  let adapter;
  try {
    adapter = getProvider(provider);
  } catch {
    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Read body as text (needed for signature verification)
  const payload = await req.text();

  // Parse + verify the webhook. Adapter pulls the headers it needs from req.headers
  // (Stripe → stripe-signature; Vipps → Authorization + x-ms-* + URL/method).
  let event;
  try {
    event = await adapter.parseWebhookEvent({
      payload,
      headers: req.headers,
      url,
      method: req.method,
    });
  } catch (err) {
    console.error(`${provider} webhook parse error:`, err);
    return new Response("Invalid signature", { status: 400 });
  }

  // --- Resolve which studio this event belongs to BEFORE dedup or processing.
  // Without this, a forged/misrouted event with a valid platform-secret signature
  // could be attributed to the wrong studio. Order of resolution:
  //   1. Connect account → look up studio_payment_providers by provider_account_id
  //   2. Event metadata (we set studio_id when creating the checkout session)
  //   3. Subscription event → look up the membership
  //   4. Payment lookup by provider_session_id → use payment.studio_id
  // If none resolve, log and accept the event but leave studio_id NULL — the
  // dedup constraint allows NULL via NULLS NOT DISTINCT, and downstream
  // processing falls back to legacy single-tenant behavior.
  let studioId: string | null = null;

  if (event.connect_account_id) {
    const { data: spp } = await admin
      .from("studio_payment_providers")
      .select("studio_id")
      .eq("provider", provider)
      .eq("provider_account_id", event.connect_account_id)
      .maybeSingle();
    if (!spp) {
      console.error(`Webhook from unregistered ${provider} account ${event.connect_account_id} — rejecting`);
      return new Response("Unknown account", { status: 400 });
    }
    studioId = spp.studio_id;
  } else if (event.metadata?.studio_id) {
    studioId = event.metadata.studio_id;
  } else if (event.provider_subscription_id) {
    const { data: m } = await admin
      .from("memberships")
      .select("studio_id")
      .eq("provider_subscription_id", event.provider_subscription_id)
      .maybeSingle();
    studioId = m?.studio_id ?? null;
  } else if (event.provider_session_id) {
    const { data: p } = await admin
      .from("payments")
      .select("studio_id")
      .eq("provider", provider)
      .eq("provider_session_id", event.provider_session_id)
      .maybeSingle();
    studioId = p?.studio_id ?? null;
  }

  // Idempotency: atomically record the event; skip if already processed.
  // The unique constraint UNIQUE NULLS NOT DISTINCT (provider, provider_event_id, studio_id)
  // is the atomic lock — concurrent webhook retries are serialized by Postgres
  // and only one wins (rows.length === 1). Losers see rows.length === 0.
  const { data: dedupRows, error: dedupError } = await admin
    .from("payment_webhook_events")
    .upsert({
      provider,
      provider_event_id: event.provider_event_id,
      event_type: event.type,
      payload: event.raw,
      studio_id: studioId,
    }, { onConflict: "provider,provider_event_id,studio_id", ignoreDuplicates: true })
    .select("id");

  if (dedupError) {
    console.error("Webhook dedup insert failed:", dedupError);
    return new Response("Internal error", { status: 500 });
  }

  if (!dedupRows || dedupRows.length === 0) {
    console.log(`Duplicate webhook event ${event.provider_event_id} for studio ${studioId}, skipping`);
    return new Response("OK", { status: 200 });
  }

  // Find our canonical payment row by provider_session_id, scoped by studio.
  // Adding the studio_id filter prevents a forged event from finding (and
  // confirming) a payment row in another studio that happens to share a
  // provider_session_id (unlikely with Stripe's globally unique IDs, but
  // defense in depth).
  let paymentId: string | null = null;
  if (event.provider_session_id) {
    let q = admin
      .from("payments")
      .select("id, status, amount, studio_id")
      .eq("provider", provider)
      .eq("provider_session_id", event.provider_session_id);
    if (studioId) q = q.eq("studio_id", studioId);
    const { data: payment } = await q.maybeSingle();
    paymentId = payment?.id ?? null;
    // Validate: if we resolved a studio AND found a payment, they must match.
    if (studioId && payment && payment.studio_id !== studioId) {
      console.error(
        `Studio mismatch: event resolved to ${studioId} but payment ${payment.id} belongs to ${payment.studio_id} — rejecting`,
      );
      return new Response("Studio mismatch", { status: 400 });
    }
  }

  // Subscription renewal / cancellation events identify the membership by subscription ID,
  // not the original session — no payment row lookup needed.
  const isSubscriptionEvent =
    event.type === "subscription.renewed" || event.type === "subscription.cancelled";
  if (!paymentId && !isSubscriptionEvent && event.type !== "unknown") {
    console.warn(`No payment row found for session ${event.provider_session_id}`);
  }

  // Handle the canonical event type
  try {
    switch (event.type) {
      case "payment.succeeded":
        if (paymentId) {
          // Branch on product_id: NULL = class booking, set = membership/clip card purchase
          const { data: pRow } = await admin
            .from("payments")
            .select("product_id, user_id, studio_id")
            .eq("id", paymentId)
            .single();

          if (pRow?.product_id) {
            // Membership / clip card purchase — atomic creation via DB function.
            // For subscriptions, provider_subscription_id is captured for future renewal events.
            const { data: membershipId } = await admin.rpc("activate_membership", {
              p_payment_id: paymentId,
              p_provider_subscription_id: event.provider_subscription_id ?? null,
            });
            if (membershipId) {
              await sendMembershipConfirmation(admin, membershipId as string);
            }
          } else {
            // Class booking — atomic confirm via existing DB function
            await admin.rpc("confirm_booking", { p_payment_id: paymentId });

            // Complete any pending referral for this user+studio
            if (pRow?.user_id && pRow?.studio_id) {
              await admin
                .from("referrals")
                .update({ status: "completed", completed_at: new Date().toISOString() })
                .eq("referred_user_id", pRow.user_id)
                .eq("studio_id", pRow.studio_id)
                .eq("status", "pending");
            }
          }

          // Capture the provider payment id in both cases
          await admin.from("payments").update({
            provider_payment_id: event.provider_payment_id ?? null,
          }).eq("id", paymentId);

          // Confirmation email — class bookings only (membership email sent above)
          if (!pRow?.product_id) {
            await sendBookingConfirmation(admin, paymentId);
          }
        }
        break;

      case "subscription.renewed":
        // Recurring monthly invoice paid — extend the membership's valid_until.
        // Pass studioId so the RPC scopes the lookup correctly when two
        // studios ever share a Stripe subscription_id namespace (post-Connect).
        if (event.provider_subscription_id) {
          await admin.rpc("renew_membership_by_subscription", {
            p_subscription_id: event.provider_subscription_id,
            p_studio_id: studioId,
          });
        }
        break;

      case "subscription.cancelled":
        // Subscription deleted in Stripe (user cancelled or final retry failed).
        if (event.provider_subscription_id) {
          await admin.rpc("cancel_membership_by_subscription", {
            p_subscription_id: event.provider_subscription_id,
            p_studio_id: studioId,
          });
        }
        break;

      case "payment.failed":
        if (paymentId) {
          await admin.from("payments").update({
            status: "failed",
            failure_code: event.failure_code ?? null,
            failure_message: event.failure_message ?? null,
          }).eq("id", paymentId);
          await admin.from("bookings").update({ status: "payment_failed" })
            .eq("payment_id", paymentId);
        }
        break;

      case "payment.cancelled":
        if (paymentId) {
          await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentId);
          await admin.from("bookings").update({ status: "payment_failed" })
            .eq("payment_id", paymentId);
        }
        break;

      case "payment.refunded":
        if (paymentId) {
          // Atomic: mark payment refunded AND cancel the booking together.
          await admin.rpc("refund_booking", { p_payment_id: paymentId });
          await admin.from("payments").update({
            refunded_amount: event.refunded_amount ?? 0,
          }).eq("id", paymentId);
        }
        break;

      case "payment.partially_refunded":
        if (paymentId) {
          await admin.from("payments").update({
            status: "partially_refunded",
            refunded_amount: event.refunded_amount ?? 0,
          }).eq("id", paymentId);
          // Booking remains confirmed on partial refund — staff handle edge cases manually.
        }
        break;

      case "unknown":
        console.log(`Unhandled webhook event type from ${provider}: ${event.provider_event_id}`);
        break;
    }

    // Mark the webhook event as processed
    await admin.from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("provider_event_id", event.provider_event_id);
  } catch (err) {
    console.error("Webhook handler error:", err);
    await admin.from("payment_webhook_events")
      .update({ error: String(err) })
      .eq("provider", provider)
      .eq("provider_event_id", event.provider_event_id);
  }

  return new Response("OK", { status: 200 });
});

async function sendBookingConfirmation(admin: ReturnType<typeof createClient>, paymentId: string) {
  if (!RESEND_API_KEY) return;

  try {
    // Fetch booking + class details
    const { data: booking } = await admin
      .from("bookings")
      .select(`
        id, studio_id, user_id,
        class_instances (
          starts_at,
          class_templates ( name, default_duration_minutes ),
          instructors ( display_name ),
          locations ( name )
        )
      `)
      .eq("payment_id", paymentId)
      .single();
    if (!booking) return;

    const idempotencyKey = `booking_confirmation_${booking.id}`;

    // Fetch these first — needed for the idempotency log INSERT (recipient is NOT NULL).
    const [{ data: { user } }, { data: studio }] = await Promise.all([
      admin.auth.admin.getUserById(booking.user_id),
      admin.from("studios").select("name, from_email, locale, timezone").eq("id", booking.studio_id).single(),
    ]);
    if (!user?.email) return;
    const studioName = (studio as any)?.name ?? "Yoga Studio";
    const studioFromEmail: string = (studio as any)?.from_email ?? FROM_EMAIL;
    const locale: string = (studio as any)?.locale ?? "nb-NO";
    const timezone: string = (studio as any)?.timezone ?? "Europe/Oslo";

    // Idempotency: INSERT the log row BEFORE sending.
    // The UNIQUE constraint on idempotency_key is the atomic lock — the first
    // function invocation wins; a webhook replay gets 23505 and skips.
    const { error: logInsertErr } = await admin
      .from("notification_log")
      .insert({
        studio_id: booking.studio_id,
        user_id: booking.user_id,
        booking_id: booking.id,
        channel: "email",
        template: "booking_confirmation",
        recipient: user.email,
        idempotency_key: idempotencyKey,
      });

    // 23505 = unique_violation — already sent (or in flight), skip
    if (logInsertErr?.code === "23505") return;
    if (logInsertErr) {
      console.error("notification_log insert error:", logInsertErr);
      return;
    }

    const ci = booking.class_instances as any;
    const startsAt = new Date(ci.starts_at);
    const className = ci.class_templates?.name ?? "Your class";
    const instructor = ci.instructors?.display_name ?? "";
    const location = ci.locations?.name ?? "";
    const duration = ci.class_templates?.default_duration_minutes ?? 60;

    const dateStr = startsAt.toLocaleDateString(locale, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: timezone,
    });
    const timeStr = startsAt.toLocaleTimeString(locale, {
      hour: "2-digit", minute: "2-digit", timeZone: timezone,
    });

    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    const fmtIso = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const calParams = new URLSearchParams({
      action: "TEMPLATE",
      text: className,
      dates: `${fmtIso(startsAt)}/${fmtIso(endsAt)}`,
      ...(location ? { location } : {}),
    });
    const calendarUrl = `https://calendar.google.com/calendar/render?${calParams}`;

    const html = buildConfirmationEmail({ studioName, className, dateStr, timeStr, instructor, location, duration, calendarUrl });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: studioFromEmail,
        to: [user.email],
        subject: `Booking confirmed — ${className}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      // Record the failure on the log row so it's visible to staff.
      // The row stays so webhook replays don't re-attempt; a manual retry
      // would need to delete this row first.
      await admin.from("notification_log")
        .update({ error: errText })
        .eq("idempotency_key", idempotencyKey);
    }
  } catch (err) {
    console.error("sendBookingConfirmation error:", err);
  }
}

async function sendMembershipConfirmation(admin: ReturnType<typeof createClient>, membershipId: string) {
  if (!RESEND_API_KEY) return;

  try {
    const { data: membership } = await admin
      .from("memberships")
      .select(`
        id, user_id, studio_id, plan_name, credits_remaining, valid_until,
        products ( type, billing_interval, commitment_months, price_minor, currency ),
        studios ( name, from_email, locale, timezone )
      `)
      .eq("id", membershipId)
      .single();
    if (!membership) return;

    const idempotencyKey = `membership_confirmation_${membership.id}`;

    const { data: { user } } = await admin.auth.admin.getUserById(membership.user_id);
    if (!user?.email) return;

    const { error: logInsertErr } = await admin.from("notification_log").insert({
      studio_id: membership.studio_id,
      user_id: membership.user_id,
      channel: "email",
      template: "membership_confirmation",
      recipient: user.email,
      idempotency_key: idempotencyKey,
    });
    if (logInsertErr?.code === "23505") return;
    if (logInsertErr) { console.error("notification_log insert error:", logInsertErr); return; }

    const product = membership.products as any;
    const studioName = (membership.studios as any)?.name ?? "Yoga Studio";
    const studioFromEmail: string = (membership.studios as any)?.from_email ?? FROM_EMAIL;
    const locale: string = (membership.studios as any)?.locale ?? "nb-NO";
    const isSubscription = product?.billing_interval === "month";
    const isClipCard = product?.type === "clip_card";

    // Currency: locale controls formatting (symbol placement, decimal separators);
    // products.currency is the canonical currency code passed through to Intl.NumberFormat.
    const currency = product?.currency ?? "NOK";
    const priceFormatted = product?.price_minor
      ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(product.price_minor / 100)
      : null;

    // valid_until is a Postgres DATE — interpret in UTC so the displayed
    // calendar date matches what's stored regardless of viewer locale.
    const validUntilFormatted = membership.valid_until
      ? new Date(membership.valid_until).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
      : null;

    const html = buildMembershipEmail({
      studioName,
      planName: membership.plan_name,
      isSubscription,
      isClipCard,
      credits: membership.credits_remaining,
      validUntilFormatted,
      commitmentMonths: product?.commitment_months ?? null,
      priceFormatted,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: studioFromEmail,
        to: [user.email],
        subject: `Welcome — ${membership.plan_name} is now active`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error (membership):", errText);
      await admin.from("notification_log")
        .update({ error: errText })
        .eq("idempotency_key", idempotencyKey);
    }
  } catch (err) {
    console.error("sendMembershipConfirmation error:", err);
  }
}

function buildMembershipEmail(p: {
  studioName: string;
  planName: string;
  isSubscription: boolean;
  isClipCard: boolean;
  credits: number | null;
  validUntilFormatted: string | null;
  commitmentMonths: number | null;
  priceFormatted: string | null;
}): string {
  const renewalLine = p.commitmentMonths
    ? `12-month commitment · Renews monthly`
    : p.isSubscription
      ? `Renews monthly · Cancel anytime`
      : null;

  const rows = [
    p.isClipCard && p.credits !== null
      ? { label: "Credits", value: `${p.credits} classes` }
      : null,
    p.validUntilFormatted
      ? { label: p.isSubscription ? "First renewal" : "Valid until", value: p.validUntilFormatted }
      : null,
    renewalLine ? { label: "Billing", value: renewalLine } : null,
    p.priceFormatted ? { label: "Amount paid", value: p.priceFormatted } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Membership active</title>
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;overflow:hidden;max-width:100%;">

          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #2e2e2e;">
              <p style="margin:0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#8a7e6e;">${esc(p.studioName)}</p>
              <h1 style="margin:12px 0 0;font-size:28px;font-weight:400;color:#f5f0eb;line-height:1.2;">
                Your membership is active
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 48px;">
              <h2 style="margin:0 0 24px;font-size:20px;font-weight:400;color:#f5f0eb;">${esc(p.planName)}</h2>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${rows.map(row => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2e2e2e;">
                    <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7e6e;font-family:sans-serif;">${esc(row.label)}</span>
                    <p style="margin:4px 0 0;font-size:15px;color:#f5f0eb;">${esc(row.value)}</p>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 48px 40px;border-top:1px solid #2e2e2e;">
              <p style="margin:0;font-size:13px;color:#8a7e6e;line-height:1.6;font-family:sans-serif;">
                ${p.isSubscription
                  ? "You can cancel your membership at any time from your account dashboard."
                  : "Your credits never expire within the validity period. Book classes from your dashboard."}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

