// Shared payment provider adapter interface.
// Every provider (Stripe, Vipps) implements PaymentProviderAdapter.
// Adding a provider: implement this interface + register in index.ts.

export type PaymentProvider = "stripe" | "vipps";

export type PaymentStatus =
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface CreateCheckoutParams {
  studio_provider_account_id: string | null;  // Stripe Connect acct_xxx / Vipps MSN (null = platform account)
  customer_email?: string;
  customer_name?: string;
  amount: number;                      // in smallest currency unit (øre for NOK)
  currency: string;                    // ISO 4217, e.g. "NOK"
  description: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;   // must include payment_id for webhook reconciliation

  // Subscription mode (one-time payment when omitted)
  recurring?: {
    interval: "day" | "week" | "month" | "year";
    interval_count?: number;
  };
}

export interface CheckoutResult {
  provider_session_id: string;         // hosted session ID (cs_xxx for Stripe)
  checkout_url: string;                // URL to redirect the user to
}

export type CanonicalEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "payment.refunded"
  | "payment.partially_refunded"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "unknown";

export interface CanonicalWebhookEvent {
  type: CanonicalEventType;
  provider_event_id: string;
  provider_session_id?: string;
  provider_payment_id?: string;        // set on succeeded
  provider_subscription_id?: string;   // set when the session/event is for a subscription
  amount?: number;
  refunded_amount?: number;
  failure_code?: string;
  failure_message?: string;
  // Multi-tenant identification:
  //  - connect_account_id: set when the event came from a connected account (Stripe Connect).
  //    Used to look up studio via studio_payment_providers.provider_account_id.
  //  - metadata: passed through from the original session/payment so the webhook
  //    can recover studio_id when no Connect account is involved.
  connect_account_id?: string;
  metadata?: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface RefundParams {
  provider_payment_id: string;
  amount?: number;                     // omit for full refund
  reason?: string;
}

export interface RefundResult {
  provider_refund_id: string;
  refunded_amount: number;
}

export interface CancelSubscriptionParams {
  provider_subscription_id: string;
  provider_account_id?: string | null;  // Stripe Connect acct_xxx; null = platform account
}

export interface CancelSubscriptionResult {
  // Unix timestamp (seconds) when the provider will actually stop the subscription.
  // The Edge Function snaps memberships.valid_until to this date so the UI shows
  // the same end date the provider does — no grace-period drift on cancellation.
  current_period_end: number;
}

// Context passed to parseWebhookEvent — adapters pick the headers/metadata they
// need. Stripe just reads `stripe-signature`; Vipps needs Authorization +
// x-ms-date + x-ms-content-sha256 plus method/path for canonical-string HMAC.
export interface WebhookRequest {
  payload: string;
  headers: Headers;
  url: URL;
  method: string;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  parseWebhookEvent(req: WebhookRequest): Promise<CanonicalWebhookEvent>;
  issueRefund(params: RefundParams): Promise<RefundResult>;
  // Schedules the subscription to cancel at the end of the current paid period.
  // The provider continues to honour the subscription until then; webhook
  // (subscription.cancelled) fires at period end and finalises the membership row.
  cancelSubscriptionAtPeriodEnd(params: CancelSubscriptionParams): Promise<CancelSubscriptionResult>;
}
