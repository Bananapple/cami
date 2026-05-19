// Vipps ePayment adapter — one-time payments only (Phase 1).
// Docs: https://developer.vippsmobilepay.com/docs/APIs/epayment-api/
//
// Reconciliation strategy:
//   createCheckoutSession sets reference = payment_id (our UUID).
//   Vipps webhooks carry { reference } = our payment_id.
//   provider_session_id = payment_id so the webhook lookup
//   (WHERE provider_session_id = reference) finds the payment row.
//
// Auto-capture: ePayment defaults to reserve-then-capture, but for yoga
// bookings there's no reason to delay. On `authorized` events we eagerly
// call /capture, then map directly to payment.succeeded. The follow-up
// `captured` webhook is swallowed by idempotency in payment_webhook_events.
//
// Recurring memberships (Vipps Recurring API) are deferred — see
// cancelSubscriptionAtPeriodEnd below, which throws.
//
// Required env vars:
//   VIPPS_BASE_URL          — https://apitest.vipps.no (test) | https://api.vipps.no (prod)
//   VIPPS_CLIENT_ID         — OAuth client id
//   VIPPS_CLIENT_SECRET     — OAuth client secret
//   VIPPS_SUBSCRIPTION_KEY  — Ocp-Apim-Subscription-Key (primary)
//   VIPPS_MSN               — Merchant Serial Number (per studio)
//   VIPPS_WEBHOOK_SECRET    — HMAC secret returned when registering the webhook

import type {
  PaymentProviderAdapter,
  CreateCheckoutParams,
  CheckoutResult,
  CanonicalWebhookEvent,
  RefundParams,
  RefundResult,
  CancelSubscriptionParams,
  CancelSubscriptionResult,
  WebhookRequest,
} from "./types.ts";

const BASE_URL = Deno.env.get("VIPPS_BASE_URL") ?? "https://apitest.vipps.no";
const CLIENT_ID = Deno.env.get("VIPPS_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("VIPPS_CLIENT_SECRET") ?? "";
const SUBSCRIPTION_KEY = Deno.env.get("VIPPS_SUBSCRIPTION_KEY") ?? "";
const MSN = Deno.env.get("VIPPS_MSN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("VIPPS_WEBHOOK_SECRET") ?? "";

const SYSTEM_NAME = "cami";
const SYSTEM_VERSION = "1.0";

// ─── Access token cache ──────────────────────────────────────────────────────
// Vipps access tokens live ~1 hour. Cache in module scope; refresh on miss or
// if we're within 60s of expiry.

let cachedToken: { token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at - now > 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${BASE_URL}/accesstoken/get`, {
    method: "POST",
    headers: {
      "client_id": CLIENT_ID,
      "client_secret": CLIENT_SECRET,
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
      "Merchant-Serial-Number": MSN,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vipps access token failed (${res.status}): ${text}`);
  }

  const body = JSON.parse(text) as { access_token: string; expires_on?: string; expires_in?: string };
  // Vipps returns expires_on as a Unix-seconds string. Fall back to 50min if missing.
  const expiresOnSec = body.expires_on ? parseInt(body.expires_on, 10) : Math.floor(now / 1000) + 3000;
  cachedToken = { token: body.access_token, expires_at: expiresOnSec * 1000 };
  return body.access_token;
}

// ─── Common request wrapper ──────────────────────────────────────────────────

async function vippsFetch(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
    "Merchant-Serial-Number": MSN,
    "Vipps-System-Name": SYSTEM_NAME,
    "Vipps-System-Version": SYSTEM_VERSION,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vipps API ${res.status} on ${method} ${path}: ${text}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Vipps API returned non-JSON on ${path}: ${text}`);
  }
}

// ─── HMAC helpers ────────────────────────────────────────────────────────────

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function sha256Base64(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

// ─── Webhook payload types ───────────────────────────────────────────────────

interface VippsWebhookPayload {
  msn: string;
  reference: string;
  pspReference?: string;
  name:
    | "AUTHORIZED"
    | "CAPTURED"
    | "TERMINATED"
    | "ABORTED"
    | "EXPIRED"
    | "REFUNDED"
    | "CANCELLED"
    | string;
  amount?: { value: number; currency: string };
  timestamp: string;
  idempotencyKey?: string;
  success?: boolean;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class VippsProvider implements PaymentProviderAdapter {
  readonly name = "vipps" as const;

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const paymentId = params.metadata.payment_id;
    if (!paymentId) {
      throw new Error("Vipps: createCheckoutSession requires metadata.payment_id");
    }
    if (params.recurring) {
      // Vipps Recurring API is a separate flow with agreement creation.
      // Norwegian members on monthly memberships continue paying by card via
      // Stripe until Phase 2 lands.
      throw new Error("Vipps: recurring/subscription mode not yet implemented (Phase 1 is one-time only)");
    }

    const body: Record<string, unknown> = {
      amount: {
        currency: params.currency.toUpperCase(),
        value: params.amount,
      },
      paymentMethod: { type: "WALLET" },
      reference: paymentId,
      returnUrl: params.success_url,
      userFlow: "WEB_REDIRECT",
      paymentDescription: params.description,
    };

    // Customer pre-fill only works if we have a Norwegian E.164 phone number.
    // Email/name aren't part of Vipps ePayment customer object — skip silently.

    const session = await vippsFetch("POST", "/epayment/v1/payments", body, paymentId);

    const redirectUrl = session.redirectUrl as string | undefined;
    if (!redirectUrl) {
      throw new Error(`Vipps create-payment response missing redirectUrl: ${JSON.stringify(session)}`);
    }

    return {
      provider_session_id: paymentId,
      checkout_url: redirectUrl,
    };
  }

  async parseWebhookEvent(req: WebhookRequest): Promise<CanonicalWebhookEvent> {
    // ─── Signature verification ────────────────────────────────────────────
    // Vipps webhook signing (Microsoft Azure Functions style):
    //   Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=<base64>
    //   String-to-sign: METHOD\nPATH_AND_QUERY\nx-ms-date;host;x-ms-content-sha256
    if (WEBHOOK_SECRET) {
      const authz = req.headers.get("authorization") ?? "";
      const xmsDate = req.headers.get("x-ms-date") ?? "";
      const host = req.headers.get("host") ?? "";
      const xmsContentSha = req.headers.get("x-ms-content-sha256") ?? "";

      // 1. Verify body hash matches the header — guards against payload tampering.
      const computedBodyHash = await sha256Base64(req.payload);
      if (computedBodyHash !== xmsContentSha) {
        throw new Error("Vipps webhook: x-ms-content-sha256 does not match body");
      }

      // 2. Extract claimed signature from Authorization header.
      const sigMatch = authz.match(/Signature=([^&\s]+)/);
      if (!sigMatch) {
        throw new Error("Vipps webhook: Authorization header missing Signature");
      }
      const claimedSig = sigMatch[1];

      // 3. Recompute expected signature.
      const pathAndQuery = req.url.pathname + req.url.search;
      const canonicalString = `${req.method}\n${pathAndQuery}\n${xmsDate};${host};${xmsContentSha}`;
      const expectedSig = await hmacSha256Base64(WEBHOOK_SECRET, canonicalString);

      if (claimedSig !== expectedSig) {
        throw new Error("Vipps webhook: signature verification failed");
      }
    }

    // ─── Parse + map to canonical event ────────────────────────────────────
    let event: VippsWebhookPayload;
    try {
      event = JSON.parse(req.payload) as VippsWebhookPayload;
    } catch {
      throw new Error("Vipps webhook: invalid JSON payload");
    }

    const raw = event as unknown as Record<string, unknown>;
    const eventId =
      event.idempotencyKey ??
      event.pspReference ??
      `${event.reference}:${event.name}:${event.timestamp}`;

    switch (event.name) {
      case "AUTHORIZED": {
        // Auto-capture eagerly. Yoga bookings have no reason to defer capture.
        // If capture fails, surface the error — payment-webhook will return 5xx
        // and Vipps will retry the webhook.
        try {
          await vippsFetch(
            "POST",
            `/epayment/v1/payments/${event.reference}/capture`,
            {
              modificationAmount: event.amount ?? undefined,
            },
            `${event.reference}:capture`,
          );
        } catch (err) {
          // If already captured (e.g. webhook retry after a previous successful
          // capture), Vipps returns 409. Treat as success and continue.
          const msg = String(err);
          if (!msg.includes("409") && !/already.*captured/i.test(msg)) {
            throw err;
          }
        }

        return {
          type: "payment.succeeded",
          provider_event_id: eventId,
          provider_session_id: event.reference,
          provider_payment_id: event.reference,
          amount: event.amount?.value,
          raw,
        };
      }

      case "CAPTURED": {
        // Idempotent — the AUTHORIZED handler already captured + surfaced
        // payment.succeeded. The dedup constraint on payment_webhook_events
        // means this row gets accepted but no extra side effects fire.
        return {
          type: "payment.succeeded",
          provider_event_id: eventId,
          provider_session_id: event.reference,
          provider_payment_id: event.reference,
          amount: event.amount?.value,
          raw,
        };
      }

      case "TERMINATED":
      case "ABORTED":
      case "EXPIRED":
      case "CANCELLED": {
        return {
          type: "payment.cancelled",
          provider_event_id: eventId,
          provider_session_id: event.reference,
          raw,
        };
      }

      case "REFUNDED": {
        return {
          type: "payment.refunded",
          provider_event_id: eventId,
          provider_payment_id: event.reference,
          refunded_amount: event.amount?.value,
          raw,
        };
      }

      default:
        return { type: "unknown", provider_event_id: eventId, raw };
    }
  }

  async issueRefund(params: RefundParams): Promise<RefundResult> {
    const body: Record<string, unknown> = {};
    if (params.amount !== undefined) {
      // Vipps requires currency on modificationAmount; for partial refunds the
      // caller must know it. We default to NOK since Vipps is Norway-only.
      body.modificationAmount = { value: params.amount, currency: "NOK" };
    }

    const result = await vippsFetch(
      "POST",
      `/epayment/v1/payments/${params.provider_payment_id}/refund`,
      body,
      `${params.provider_payment_id}:refund:${Date.now()}`,
    );

    const refunded = result.amount as { value?: number } | undefined;

    return {
      provider_refund_id: (result.pspReference ?? params.provider_payment_id) as string,
      refunded_amount: refunded?.value ?? params.amount ?? 0,
    };
  }

  async cancelSubscriptionAtPeriodEnd(_params: CancelSubscriptionParams): Promise<CancelSubscriptionResult> {
    // Vipps Recurring is a separate API (agreement-based). Not in Phase 1 scope —
    // there should be no Vipps-backed subscriptions in production yet.
    throw new Error("Vipps: subscription cancellation not yet implemented (recurring is Phase 2)");
  }
}
