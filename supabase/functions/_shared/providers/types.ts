// Shared payment provider adapter interface.
// Every provider (Stripe, Frisbii, Vipps) implements PaymentProviderAdapter.
// Adding a provider: implement this interface + register in index.ts.

export type PaymentProvider = "stripe" | "frisbii" | "vipps";

export type PaymentStatus =
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface CreateCheckoutParams {
  studio_provider_account_id: string | null;  // Stripe Connect acct_xxx / Frisbii merchant id (null = platform account)
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

export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  parseWebhookEvent(payload: string, signature: string): Promise<CanonicalWebhookEvent>;
  issueRefund(params: RefundParams): Promise<RefundResult>;
}
