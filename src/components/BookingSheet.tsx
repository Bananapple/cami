import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClassInstances } from "@/hooks/useClassInstances";
import type { ClassInstance } from "@/hooks/useClassInstances";
import DateStrip from "@/components/booking/DateStrip";
import SessionList from "@/components/booking/SessionList";
import OrderSummary from "@/components/booking/OrderSummary";
import AuthForm from "@/components/booking/AuthForm";
import { supabase } from "@/integrations/supabase/client";
import { useStudioConfig } from "@/hooks/useStudioConfig";

type Step = "date" | "confirm" | "auth" | "checkout";

interface BookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const BookingSheet = ({ isOpen, onClose }: BookingSheetProps) => {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<ClassInstance | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { instances: sessions } = useClassInstances();
  const { isAuthenticated } = useAuth();
  const { studioName, location } = useStudioConfig();

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("date");
      setSelectedSession(null);
      setCheckoutError(null);
    }, 300);
  };

  const handleSelectSession = (session: ClassInstance) => {
    setSelectedSession(session);
    setStep("confirm");
  };

  const handleContinueFromConfirm = () => {
    if (isAuthenticated) {
      setStep("checkout");
    } else {
      setStep("auth");
    }
  };

  const handleAuthSuccess = () => {
    setStep("checkout");
  };

  const handleCheckout = async () => {
    if (!selectedSession) return;
    setCheckoutError(null);
    setCheckoutLoading(true);

    try {
      const returnUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          class_instance_id: selectedSession.id,
          return_url: returnUrl,
        },
      });

      if (error || !data?.checkout_url) {
        const message = error?.message ?? data?.error ?? "Unable to start checkout. Please try again.";
        setCheckoutError(message);
        return;
      }

      // Hand off to the provider's hosted checkout page
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setCheckoutError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const goBack = () => {
    switch (step) {
      case "confirm": setStep("date"); break;
      case "auth": setStep("confirm"); break;
      case "checkout": setStep("confirm"); break;
    }
  };

  const stepLabel = () => {
    switch (step) {
      case "date":     return "Select a Date";
      case "confirm":  return "Session Details";
      case "auth":     return "Sign In";
      case "checkout": return "Payment";
    }
  };

  const showBack = step !== "date";
  const showSplitLayout = step === "auth" || step === "checkout";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className={`p-0 border-l border-border bg-background overflow-y-auto ${
          showSplitLayout ? "w-full sm:max-w-2xl" : "w-full sm:max-w-md"
        }`}
      >
        <SheetTitle className="sr-only">Book a Session</SheetTitle>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          {showBack ? (
            <button onClick={goBack} className="p-1 hover:opacity-70 transition-opacity" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {stepLabel()}
          </p>
          <div className="w-7" />
        </div>

        {/* Step: Date & Session Selection */}
        {step === "date" && (
          <div className="px-6 py-6 space-y-6">
            <div>
              <h2 className="text-2xl font-serif text-foreground">{studioName}</h2>
              <p className="text-sm text-muted-foreground font-serif mt-1">
                {location ? `Upcoming sessions in ${location}` : "Upcoming sessions"}
              </p>
            </div>
            <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <SessionList
              sessions={sessions}
              selectedDate={selectedDate}
              onSelectSession={handleSelectSession}
            />
          </div>
        )}

        {/* Step: Session Confirmation */}
        {step === "confirm" && selectedSession && (
          <div className="px-6 py-6 space-y-6">
            <div className="bg-card rounded-xl p-6 space-y-4">
              <h3 className="text-xl font-serif text-foreground uppercase">
                {selectedSession.class_name}
              </h3>
              <p className="text-sm text-muted-foreground font-serif">
                with {selectedSession.practitioner_name}
              </p>
              <div className="border-t border-border pt-4 space-y-2 text-sm text-muted-foreground font-sans">
                <p>
                  {selectedDate.toLocaleDateString("nb-NO", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {selectedSession.time}
                </p>
                <p>📍 {selectedSession.location}</p>
                <p>{selectedSession.duration} min · {selectedSession.level}</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-y border-border">
              <span className="text-sm text-muted-foreground font-sans">Drop-in</span>
              <span className="text-lg font-serif text-foreground">
                kr {(selectedSession.price ?? 250).toLocaleString("nb-NO")}
              </span>
            </div>

            <button
              onClick={handleContinueFromConfirm}
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
            >
              Continue to Checkout →
            </button>

            <p className="text-xs text-center text-muted-foreground font-serif">
              Already a member?{" "}
              <button onClick={() => setStep("auth")} className="text-primary hover:underline">
                Log in
              </button>
            </p>
          </div>
        )}

        {/* Split layout: Auth + Checkout steps */}
        {showSplitLayout && selectedSession && (
          <div className="flex flex-col sm:flex-row min-h-[calc(100vh-60px)]">
            {/* Left: Order Summary */}
            <div className="sm:w-[45%] p-6 flex-shrink-0">
              <OrderSummary session={selectedSession} selectedDate={selectedDate} />
            </div>

            {/* Right: Auth form or Checkout CTA */}
            <div className="flex-1 p-6 bg-background border-t sm:border-t-0 sm:border-l border-border">
              {step === "auth" && <AuthForm onSuccess={handleAuthSuccess} />}

              {step === "checkout" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-serif text-foreground">Ready to book?</h3>
                    <p className="text-sm text-muted-foreground font-sans mt-1">
                      You'll be taken to our secure payment page to complete your booking.
                    </p>
                  </div>

                  <div className="bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground font-sans space-y-1">
                    <p>· {selectedSession.class_name}</p>
                    <p>· {selectedDate.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}</p>
                    <p>· kr {(selectedSession.price ?? 250).toLocaleString("nb-NO")}</p>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    className="w-full bg-primary hover:bg-primary/80 disabled:opacity-60 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
                  >
                    {checkoutLoading ? "Preparing checkout…" : "Pay now →"}
                  </button>

                  {checkoutError && (
                    <p className="text-sm text-destructive text-center font-sans">
                      {checkoutError}
                    </p>
                  )}

                  <p className="text-xs text-center text-muted-foreground font-sans">
                    Secure payment · 24-hour free cancellation
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BookingSheet;
