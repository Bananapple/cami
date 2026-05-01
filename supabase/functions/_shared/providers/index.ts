import { StripeProvider } from "./stripe.ts";
import { FrisbiiProvider } from "./frisbii.ts";
import type { PaymentProvider, PaymentProviderAdapter } from "./types.ts";

export function getProvider(name: PaymentProvider): PaymentProviderAdapter {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "frisbii":
      return new FrisbiiProvider();
    case "vipps":
      // Implement VippsProvider in ./vipps.ts when ready
      throw new Error("Vipps provider not yet implemented");
    default:
      throw new Error(`Unknown payment provider: ${name}`);
  }
}

export type { PaymentProvider, PaymentProviderAdapter } from "./types.ts";
