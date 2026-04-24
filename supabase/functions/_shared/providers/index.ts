import { StripeProvider } from "./stripe.ts";
import type { PaymentProvider, PaymentProviderAdapter } from "./types.ts";

export function getProvider(name: PaymentProvider): PaymentProviderAdapter {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "frisbii":
      // Implement FrisbiiProvider in ./frisbii.ts when ready
      throw new Error("Frisbii provider not yet implemented");
    case "vipps":
      // Implement VippsProvider in ./vipps.ts when ready
      throw new Error("Vipps provider not yet implemented");
    default:
      throw new Error(`Unknown payment provider: ${name}`);
  }
}

export type { PaymentProvider, PaymentProviderAdapter } from "./types.ts";
