// Frisbii (Billwerk+) payment provider adapter.
// Docs: https://docs.frisbii.com/
//
// Checkout reconciliation strategy:
//   createCheckoutSession sets order.handle = payment_id (our UUID).
//   Frisbii creates an invoice with handle = that order handle.
//   invoice_settled webhook carries invoice = order.handle = payment_id.
//   We return provider_session_id = payment_id so the webhook lookup
//   (WHERE provider_session_id = invoice_handle) finds the payment row.
//
// Required env vars:
//   FRISBII_API_KEY       — private key (format: priv_xxxx)
//   FRISBII_WEBHOOK_SECRET — webhook signing secret from Frisbii dashboard

import type {
  PaymentProviderAdapter,
  CreateCheckoutParams,
  CheckoutResult,
  CanonicalWebhookEvent,
  RefundParams,
  RefundResult,
  CancelSubscriptionParams,
  CancelSubscriptionResult,
} from "./types.ts";

const CHECKOUT_BASE = "https://checkout-api.frisbii.com/v1";
const API_BASE = "https://api.frisbii.com/v1";
const API_KEY = Deno.env.get("FRISBII_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("FRISBII_WEBHOOK_SECRET") ?? "";

function basicAuth(): string {
  return "Basic " + btoa(API_KEY + ":");
}

async function apiPost(base: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Authorization": basicAuth(),
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Frisbii API ${res.status} on ${path}: ${text}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Frisbii API returned non-JSON on ${path}: ${text}`);
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface FrisbiiWebhookPayload {
  id: string;
  event_id?: string;
  event_type: string;
  timestamp: string;
  signature: string;
  // Associated resource handles (present depending on event type)
  customer?: string;
  subscription?: string;
  invoice?: string;
  charge?: string;
  payment_method?: string;
  // Amount in smallest currency unit (set on some events)
  amount?: number;
}

export class FrisbiiProvider implements PaymentProviderAdapter {
  readonly name = "frisbii" as const;

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const paymentId = params.metadata.payment_id;

    const body: Record<string, unknown> = {
      order: {
        handle: paymentId,
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        ordertext: params.description,
      },
      accept_url: params.success_url,
      cancel_url: params.cancel_url,
      settle: true,
    };

    // Customer pre-fill
    if (params.customer_email || params.customer_name) {
      const nameParts = (params.customer_name ?? "").split(" ");
      body.customer = {
        ...(params.customer_email ? { email: params.customer_email } : {}),
        ...(nameParts[0] ? { first_name: nameParts[0] } : {}),
        ...(nameParts.length > 1 ? { last_name: nameParts.slice(1).join(" ") } : {}),
      };
    }

    // TODO: Frisbii subscription checkout requires creating a Plan + Subscription
    // in the Frisbii dashboard first. The hosted checkout for recurring charges
    // uses a different session type (session/recurring). For now, one-time charges
    // only — monthly memberships via Frisbii need a separate implementation.
    if (params.recurring) {
      console.warn("FrisbiiProvider: subscription mode not yet implemented, falling back to one-time charge");
    }

    const session = await apiPost(CHECKOUT_BASE, "/session/charge", body);

    const checkoutUrl = (session.url ?? session.checkout_url) as string | undefined;
    if (!checkoutUrl) {
      throw new Error(`Frisbii checkout response missing url field: ${JSON.stringify(session)}`);
    }

    // provider_session_id = payment_id = invoice handle
    // so invoice_settled webhook can look up this row via provider_session_id = event.invoice
    return {
      provider_session_id: paymentId,
      checkout_url: checkoutUrl,
    };
  }

  async parseWebhookEvent(payload: string, _signatureHeader: string): Promise<CanonicalWebhookEvent> {
    let event: FrisbiiWebhookPayload;
    try {
      event = JSON.parse(payload) as FrisbiiWebhookPayload;
    } catch {
      throw new Error("Frisbii webhook: invalid JSON payload");
    }

    // Signature is in the payload (not a header like Stripe).
    // signature = hex(hmac_sha256(webhook_secret, timestamp + id))
    if (WEBHOOK_SECRET) {
      const expected = await hmacSha256Hex(WEBHOOK_SECRET, event.timestamp + event.id);
      if (event.signature !== expected) {
        throw new Error("Frisbii webhook: signature verification failed");
      }
    }

    const raw = event as unknown as Record<string, unknown>;
    const eventId = event.id ?? event.event_id ?? "unknown";

    switch (event.event_type) {
      case "invoice_settled": {
        return {
          type: "payment.succeeded",
          provider_event_id: eventId,
          // invoice handle = order.handle = our payment_id — used for payment row lookup
          provider_session_id: event.invoice,
          // invoice handle also used for refunds (Frisbii /refund takes invoice handle)
          provider_payment_id: event.invoice,
          provider_subscription_id: event.subscription,
          amount: event.amount,
          raw,
        };
      }

      case "invoice_failed":
      case "invoice_hard_declined": {
        return {
          type: "payment.failed",
          provider_event_id: eventId,
          provider_session_id: event.invoice,
          failure_code: event.event_type,
          raw,
        };
      }

      case "invoice_cancelled": {
        return {
          type: "payment.cancelled",
          provider_event_id: eventId,
          provider_session_id: event.invoice,
          raw,
        };
      }

      case "refund_settled":
      case "credit_note_settled": {
        return {
          type: "payment.refunded",
          provider_event_id: eventId,
          provider_payment_id: event.invoice ?? event.charge,
          refunded_amount: event.amount,
          raw,
        };
      }

      case "subscription_cancelled":
      case "subscription_inactivated":
      case "subscription_expired": {
        return {
          type: "subscription.cancelled",
          provider_event_id: eventId,
          provider_subscription_id: event.subscription,
          raw,
        };
      }

      default:
        return { type: "unknown", provider_event_id: eventId, raw };
    }
  }

  async issueRefund(params: RefundParams): Promise<RefundResult> {
    const body: Record<string, unknown> = {
      invoice: params.provider_payment_id,
    };
    if (params.amount !== undefined) {
      body.amount = params.amount;
    }
    if (params.reason) {
      body.text = params.reason;
    }

    const result = await apiPost(API_BASE, "/refund", body);

    if (result.state === "failed") {
      throw new Error(`Frisbii refund failed for invoice ${params.provider_payment_id}`);
    }

    return {
      provider_refund_id: (result.id ?? result.handle ?? params.provider_payment_id) as string,
      refunded_amount: (result.amount ?? params.amount ?? 0) as number,
    };
  }

  async cancelSubscriptionAtPeriodEnd(_params: CancelSubscriptionParams): Promise<CancelSubscriptionResult> {
    // Frisbii subscription checkout is not yet implemented (see createCheckoutSession),
    // so there shouldn't be any Frisbii-backed memberships in production. If one
    // appears, surface it loudly rather than silently no-op.
    throw new Error("Frisbii subscription cancellation not yet implemented");
  }
}
