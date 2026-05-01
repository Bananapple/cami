import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft } from "lucide-react";
import AuthForm from "@/components/booking/AuthForm";
import { supabase } from "@/integrations/supabase/client";
import { useBuyProduct, type Product } from "@/hooks/useProducts";

interface ProductPurchaseSheetProps {
  product: Product | null;
  onClose: () => void;
}

type Step = "summary" | "auth" | "checkout";

const ProductPurchaseSheet = ({ product, onClose }: ProductPurchaseSheetProps) => {
  const [step, setStep] = useState<Step>("summary");
  const [error, setError] = useState<string | null>(null);
  const buyProduct = useBuyProduct();

  const isOpen = !!product;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("summary");
      setError(null);
    }, 300);
  };

  const handleContinue = async () => {
    if (!product) return;
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStep("auth");
      return;
    }

    setStep("checkout");
    try {
      const { checkout_url } = await buyProduct.mutateAsync(product.id);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
      setStep("summary");
    }
  };

  const handleAuthSuccess = async () => {
    if (!product) return;
    setStep("checkout");
    try {
      const { checkout_url } = await buyProduct.mutateAsync(product.id);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
      setStep("summary");
    }
  };

  if (!product) return null;

  const priceLabel = `${product.currency === "NOK" ? "kr" : product.currency} ${(product.price_minor / 100).toLocaleString("nb-NO")}`;
  const intervalLabel = product.billing_interval === "month" ? " / month" : "";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent side="bottom" className="h-[90vh] sm:max-w-lg sm:mx-auto sm:rounded-t-2xl bg-background p-0 overflow-y-auto">
        <SheetTitle className="sr-only">Purchase {product.name}</SheetTitle>

        <div className="sticky top-0 bg-background z-10 px-6 py-4 border-b border-border flex items-center justify-between">
          {step === "auth" ? (
            <button
              type="button"
              onClick={() => setStep("summary")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : <div className="w-5" />}
          <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {step === "auth" ? "Sign in" : "Purchase"}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-8">
          {step === "auth" ? (
            <AuthForm onSuccess={handleAuthSuccess} />
          ) : (
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-6 space-y-3">
                <p className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {product.tag ?? "Product"}
                </p>
                <h2 className="text-2xl font-serif text-foreground leading-tight">{product.name}</h2>
                {product.description && (
                  <p className="text-sm text-muted-foreground font-sans leading-relaxed">{product.description}</p>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-y border-border">
                <span className="text-sm text-muted-foreground font-sans">Total</span>
                <span className="text-lg font-serif text-foreground">
                  {priceLabel}{intervalLabel}
                </span>
              </div>

              {product.commitment_months ? (
                <p className="text-xs text-muted-foreground font-sans text-center">
                  {product.commitment_months}-month commitment.
                </p>
              ) : null}

              {error && (
                <p className="text-sm text-destructive font-sans">{error}</p>
              )}

              <button
                type="button"
                onClick={handleContinue}
                disabled={buyProduct.isPending || step === "checkout"}
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {buyProduct.isPending || step === "checkout" ? "Starting checkout…" : "Continue to checkout →"}
              </button>

              <p className="text-xs text-center text-muted-foreground font-serif">
                You'll be taken to a secure payment page.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductPurchaseSheet;
