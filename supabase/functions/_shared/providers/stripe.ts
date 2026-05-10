import Stripe from "npm:stripe@14";
// redeploy subscription webhook handlers
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

const SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

export class StripeProvider implements PaymentProviderAdapter {
  readonly name = "stripe" as const;
  private stripe = new Stripe(SECRET_KEY, { apiVersion: "2024-04-10" });

  private async resolveCustomer(
    email: string | undefined,
    name: string | undefined,
    stripeAccount: string | undefined,
  ): Promise<string | undefined> {
    if (!email) return undefined;
    const opts = stripeAccount ? { stripeAccount } : undefined;
    try {
      const existing = await this.stripe.customers.list({ email, limit: 1 }, opts);
      if (existing.data.length > 0) {
        const cus = existing.data[0];
        if (name && !cus.name) {
          await this.stripe.customers.update(cus.id, { name }, opts);
        }
        return cus.id;
      }
      const created = await this.stripe.customers.create({ email, name }, opts);
      return created.id;
    } catch (err) {
      console.error("resolveCustomer failed:", err);
      return undefined;
    }
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const stripeAccount = params.studio_provider_account_id ?? undefined;
    const customerId = await this.resolveCustomer(
      params.customer_email,
      params.customer_name,
      stripeAccount,
    );

    const isSubscription = !!params.recurring;
    const baseMetadata = {
      ...params.metadata,
      ...(params.customer_name ? { customer_name: params.customer_name } : {}),
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: isSubscription ? "subscription" : "payment",
      billing_address_collection: "auto",
      // Expire payment sessions after 30 min so abandoned checkouts can't
      // pay later and conflict with the stale-pending-booking sweeper.
      // Stripe enforces min 30 min, max 24h. Subscription mode rejects expires_at.
      ...(isSubscription ? {} : { expires_at: Math.floor(Date.now() / 1000) + 30 * 60 }),
      ...(customerId
        ? { customer: customerId }
        : params.customer_email
          ? { customer_email: params.customer_email }
          : {}),
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: { name: params.description },
            unit_amount: params.amount,              // already in øre/cents
            ...(isSubscription
              ? {
                  recurring: {
                    interval: params.recurring!.interval,
                    interval_count: params.recurring!.interval_count ?? 1,
                  },
                }
              : {}),
          },
          quantity: 1,
        },
      ],
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      metadata: baseMetadata,
    };

    if (isSubscription) {
      // Mirror metadata onto the subscription so renewal webhooks can find our payment row
      sessionParams.subscription_data = { metadata: baseMetadata };
    } else {
      sessionParams.payment_intent_data = {
        description: params.customer_name
          ? `${params.description} — ${params.customer_name}`
          : params.description,
      };
    }

    const session = await this.stripe.checkout.sessions.create(
      sessionParams,
      stripeAccount ? { stripeAccount } : undefined,
    );

    return {
      provider_session_id: session.id,
      checkout_url: session.url!,
    };
  }

  async parseWebhookEvent(payload: string, signature: string): Promise<CanonicalWebhookEvent> {
    let event: Stripe.Event;
    try {
      event = await this.stripe.webhooks.constructEventAsync(payload, signature, WEBHOOK_SECRET);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err}`);
    }

    const raw = event as unknown as Record<string, unknown>;
    // event.account is set on Connect events, identifying which connected
    // account the event originated from. Used for studio resolution downstream.
    const connect_account_id = (event.account as string | undefined) ?? undefined;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: "payment.succeeded",
          provider_event_id: event.id,
          provider_session_id: session.id,
          provider_payment_id: session.payment_intent as string | undefined,
          provider_subscription_id: session.subscription as string | undefined,
          amount: session.amount_total ?? undefined,
          connect_account_id,
          metadata: (session.metadata as Record<string, string> | null) ?? undefined,
          raw,
        };
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: "payment.cancelled",
          provider_event_id: event.id,
          provider_session_id: session.id,
          connect_account_id,
          metadata: (session.metadata as Record<string, string> | null) ?? undefined,
          raw,
        };
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const lastErr = pi.last_payment_error;
        return {
          type: "payment.failed",
          provider_event_id: event.id,
          provider_payment_id: pi.id,
          failure_code: lastErr?.code ?? undefined,
          failure_message: lastErr?.message ?? undefined,
          connect_account_id,
          metadata: (pi.metadata as Record<string, string> | null) ?? undefined,
          raw,
        };
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refunded = charge.amount_refunded;
        const total = charge.amount;
        return {
          type: refunded >= total ? "payment.refunded" : "payment.partially_refunded",
          provider_event_id: event.id,
          provider_payment_id: charge.payment_intent as string | undefined,
          refunded_amount: refunded,
          connect_account_id,
          metadata: (charge.metadata as Record<string, string> | null) ?? undefined,
          raw,
        };
      }
      case "invoice.paid": {
        // Recurring subscription billing succeeded — extend the membership.
        // Skip the very first invoice (billing_reason: 'subscription_create') —
        // checkout.session.completed already creates the membership.
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_create") {
          return { type: "unknown", provider_event_id: event.id, connect_account_id, raw };
        }
        return {
          type: "subscription.renewed",
          provider_event_id: event.id,
          provider_subscription_id: invoice.subscription as string | undefined,
          amount: invoice.amount_paid ?? undefined,
          connect_account_id,
          // Subscription events don't carry our metadata directly — webhook handler
          // looks up studio_id via the membership's provider_subscription_id.
          raw,
        };
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: "subscription.cancelled",
          provider_event_id: event.id,
          provider_subscription_id: sub.id,
          connect_account_id,
          raw,
        };
      }
      default:
        return { type: "unknown", provider_event_id: event.id, connect_account_id, raw };
    }
  }

  async issueRefund(params: RefundParams): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: params.provider_payment_id,
      ...(params.amount !== undefined ? { amount: params.amount } : {}),
      ...(params.reason ? { reason: params.reason as Stripe.RefundCreateParams["reason"] } : {}),
    });

    return {
      provider_refund_id: refund.id,
      refunded_amount: refund.amount,
    };
  }

  async cancelSubscriptionAtPeriodEnd(params: CancelSubscriptionParams): Promise<CancelSubscriptionResult> {
    const opts = params.provider_account_id ? { stripeAccount: params.provider_account_id } : undefined;
    const sub = await this.stripe.subscriptions.update(
      params.provider_subscription_id,
      { cancel_at_period_end: true },
      opts,
    );
    return { current_period_end: sub.current_period_end };
  }
}
