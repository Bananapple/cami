import { useState } from "react";
import { CreditCard, Plus, Check } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";

interface PaymentSelectorProps {
  onSelectPayment: (last4: string) => void;
  onAddNew: () => void;
}

const PaymentSelector = ({ onSelectPayment, onAddNew }: PaymentSelectorProps) => {
  const { paymentMethods, isLoading } = usePaymentMethods();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (pm: typeof paymentMethods[0]) => {
    setSelectedId(pm.id);
  };

  const handleConfirm = () => {
    const pm = paymentMethods.find((p) => p.id === selectedId);
    if (pm) onSelectPayment(pm.last4);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-serif text-foreground">Select payment method</h3>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : paymentMethods.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
            Saved Cards
          </p>
          {paymentMethods.map((pm) => (
            <button
              key={pm.id}
              onClick={() => handleSelect(pm)}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                selectedId === pm.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-sans text-foreground">
                  {pm.brand} ending in {pm.last4}
                </p>
                <p className="text-xs text-muted-foreground font-sans">
                  Expires {pm.expiry_month}/{pm.expiry_year}
                </p>
              </div>
              {selectedId === pm.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      ) : null}

      <button
        onClick={onAddNew}
        className="w-full flex items-center gap-3 p-4 rounded-lg border border-dashed border-border hover:border-primary/50 transition-all text-left"
      >
        <Plus className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-sans text-foreground">Add new card</span>
      </button>

      {selectedId && (
        <>
          <button
            onClick={handleConfirm}
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
          >
            Confirm & Pay →
          </button>
          <p className="text-xs text-center text-muted-foreground font-sans">
            By confirming, you agree to our Terms of Service
          </p>
        </>
      )}
    </div>
  );
};

export default PaymentSelector;
