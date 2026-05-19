import { StripeProvider } from "./stripe.ts";
import { VippsProvider } from "./vipps.ts";
import type { PaymentProvider, PaymentProviderAdapter } from "./types.ts";

export function getProvider(name: PaymentProvider): PaymentProviderAdapter {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "vipps":
      return new VippsProvider();
    default:
      throw new Error(`Unknown payment provider: ${name}`);
  }
}

export type { PaymentProvider, PaymentProviderAdapter } from "./types.ts";
