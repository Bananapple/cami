// Public endpoint — no JWT auth. Signature verification is done by each provider adapter.
// URL pattern: /functions/v1/payment-webhook/stripe  (provider name as last path segment)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";
import type { PaymentProvider } from "../_shared/providers/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const signature =
    req.headers.get("stripe-signature") ??
    req.headers.get("frisbii-signature") ??
    req.headers.get("x-webhook-signature") ??
    "";

  // Parse + verify the webhook
  let event;
  try {
    event = await adapter.parseWebhookEvent(payload, signature);
  } catch (err) {
    console.error(`${provider} webhook parse error:`, err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: record the event; skip if already processed
  const { error: dedupError, count } = await admin
    .from("payment_webhook_events")
    .insert({
      provider,
      provider_event_id: event.provider_event_id,
      event_type: event.type,
      payload: event.raw,
    }, { count: "exact" })
    .select()
    .limit(0);

  if (count === 0 || dedupError?.code === "23505") {
    // Already processed (unique constraint violation) or nothing inserted
    console.log(`Duplicate webhook event ${event.provider_event_id}, skipping`);
    return new Response("OK", { status: 200 });
  }

  // Find our canonical payment row by provider_session_id
  let paymentId: string | null = null;
  if (event.provider_session_id) {
    const { data: payment } = await admin
      .from("payments")
      .select("id, status, amount")
      .eq("provider", provider)
      .eq("provider_session_id", event.provider_session_id)
      .maybeSingle();
    paymentId = payment?.id ?? null;
  }

  if (!paymentId && event.type !== "unknown") {
    console.warn(`No payment row found for session ${event.provider_session_id}`);
  }

  // Handle the canonical event type
  try {
    switch (event.type) {
      case "payment.succeeded":
        if (paymentId) {
          await admin.from("payments").update({
            status: "succeeded",
            provider_payment_id: event.provider_payment_id ?? null,
          }).eq("id", paymentId);
          await admin.from("bookings").update({ status: "confirmed" })
            .eq("payment_id", paymentId);
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
      case "payment.partially_refunded":
        if (paymentId) {
          await admin.from("payments").update({
            status: event.type === "payment.refunded" ? "refunded" : "partially_refunded",
            refunded_amount: event.refunded_amount ?? 0,
          }).eq("id", paymentId);
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
    // Still return 200 so the provider doesn't keep retrying a non-transient error
  }

  return new Response("OK", { status: 200 });
});
