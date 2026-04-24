import Stripe from "npm:stripe@14";
import type {
  PaymentProviderAdapter,
  CreateCheckoutParams,
  CheckoutResult,
  CanonicalWebhookEvent,
  RefundParams,
  RefundResult,
} from "./types.ts";

const SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

export class StripeProvider implements PaymentProviderAdapter {
  readonly name = "stripe" as const;
  private stripe = new Stripe(SECRET_KEY, { apiVersion: "2024-04-10" });

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const session = await this.stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        mode: "payment",
        ...(params.customer_email ? { customer_email: params.customer_email } : {}),
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              product_data: { name: params.description },
              unit_amount: params.amount,              // already in øre/cents
            },
            quantity: 1,
          },
        ],
        success_url: params.success_url,
        cancel_url: params.cancel_url,
        metadata: params.metadata,
      },
      // Destination charge to the studio's Connect account
      params.studio_provider_account_id
        ? { stripeAccount: params.studio_provider_account_id }
        : undefined,
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

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: "payment.succeeded",
          provider_event_id: event.id,
          provider_session_id: session.id,
          provider_payment_id: session.payment_intent as string | undefined,
          amount: session.amount_total ?? undefined,
          raw,
        };
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: "payment.cancelled",
          provider_event_id: event.id,
          provider_session_id: session.id,
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
          raw,
        };
      }
      default:
        return { type: "unknown", provider_event_id: event.id, raw };
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
}
