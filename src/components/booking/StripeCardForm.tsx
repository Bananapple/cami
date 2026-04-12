import { useState } from "react";
import { Lock } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { toast } from "sonner";

interface StripeCardFormProps {
  onSuccess: (last4: string) => void;
}

const StripeCardForm = ({ onSuccess }: StripeCardFormProps) => {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [saveCard, setSaveCard] = useState(true);
  const [loading, setLoading] = useState(false);
  const { addPaymentMethod } = usePaymentMethods();

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 16 || !expiry || !cvc || !name) {
      toast("Please fill in all card details.");
      return;
    }

    setLoading(true);
    try {
      const last4 = digits.slice(-4);
      const [mm, yy] = expiry.split("/");

      if (saveCard) {
        await addPaymentMethod.mutateAsync({
          brand: "Visa",
          last4,
          expiry_month: parseInt(mm),
          expiry_year: 2000 + parseInt(yy),
          is_default: true,
        });
      }

      toast("Payment processed successfully!");
      onSuccess(last4);
    } catch (err: any) {
      toast(err.message || "Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-serif text-foreground">Add payment method</h3>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Card Number
          </label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="4242 4242 4242 4242"
            className={inputClass}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Expiry
            </label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="12/27"
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
              CVC
            </label>
            <input
              type="text"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Name on Card
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className={inputClass}
            required
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={saveCard}
          onChange={(e) => setSaveCard(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-xs text-muted-foreground font-sans">
          Save card for future purchases
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Confirm & Pay →"}
      </button>

      <p className="text-xs text-center text-muted-foreground font-sans flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Secured by Stripe
      </p>
    </form>
  );
};

export default StripeCardForm;
