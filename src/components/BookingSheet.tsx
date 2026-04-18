import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { useBookings } from "@/hooks/useBookings";
import DateStrip from "@/components/booking/DateStrip";
import SessionList from "@/components/booking/SessionList";
import OrderSummary from "@/components/booking/OrderSummary";
import AuthForm from "@/components/booking/AuthForm";
import PaymentSelector from "@/components/booking/PaymentSelector";
import StripeCardForm from "@/components/booking/StripeCardForm";
import ConfirmationView from "@/components/booking/ConfirmationView";
import type { Tables } from "@/integrations/supabase/types";
import { useStudioConfig } from "@/hooks/useStudioConfig";

type Session = Tables<"sessions">;
type Step = "date" | "confirm" | "auth" | "payment" | "addCard" | "success";

interface BookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const BookingSheet = ({ isOpen, onClose }: BookingSheetProps) => {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const { sessions } = useSessions();
  const { isAuthenticated, user } = useAuth();
  const { createBooking } = useBookings();
  const { studioName, location } = useStudioConfig();

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("date");
      setSelectedSession(null);
      setBookingError(null);
    }, 300);
  };

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    setStep("confirm");
  };

  const handleContinueFromConfirm = () => {
    if (isAuthenticated) {
      setStep("payment");
    } else {
      setStep("auth");
    }
  };

  const handleAuthSuccess = () => {
    setStep("payment");
  };

  const handlePaymentComplete = async (last4: string) => {
    if (!selectedSession) return;
    setBookingError(null);

    try {
      await createBooking.mutateAsync({
        sessionId: selectedSession.id,
        sessionDate: selectedDate.toISOString().split("T")[0],
        paymentMethodLast4: last4,
        amountPaid: selectedSession.price ?? 250,
      });
    } catch (err: any) {
      setBookingError(err.message || "Booking failed. Please try again.");
      return;
    }

    setStep("success");
  };

  const goBack = () => {
    switch (step) {
      case "confirm":
        setStep("date");
        break;
      case "auth":
        setStep("confirm");
        break;
      case "payment":
        setStep("confirm");
        break;
      case "addCard":
        setStep("payment");
        break;
    }
  };

  const stepLabel = () => {
    switch (step) {
      case "date": return "Select a Date";
      case "confirm": return "Session Details";
      case "auth": return "Sign In";
      case "payment": return "Payment";
      case "addCard": return "Add Card";
      case "success": return "Confirmed";
    }
  };

  const showBack = step !== "date" && step !== "success";
  const showSplitLayout = ["auth", "payment", "addCard"].includes(step);

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

        {/* Split layout steps */}
        {showSplitLayout && selectedSession && (
          <div className="flex flex-col sm:flex-row min-h-[calc(100vh-60px)]">
            {/* Left: Order Summary */}
            <div className="sm:w-[45%] p-6 flex-shrink-0">
              <OrderSummary session={selectedSession} selectedDate={selectedDate} />
            </div>

            {/* Right: Form */}
            <div className="flex-1 p-6 bg-background border-t sm:border-t-0 sm:border-l border-border">
              {step === "auth" && <AuthForm onSuccess={handleAuthSuccess} />}
              {step === "payment" && (
                <>
                  <PaymentSelector
                    onSelectPayment={handlePaymentComplete}
                    onAddNew={() => setStep("addCard")}
                    loading={createBooking.isPending}
                  />
                  {bookingError && (
                    <p className="text-sm text-destructive mt-4 text-center font-sans">
                      {bookingError}
                    </p>
                  )}
                </>
              )}
              {step === "addCard" && (
                <>
                  <StripeCardForm onSuccess={handlePaymentComplete} />
                  {bookingError && (
                    <p className="text-sm text-destructive mt-4 text-center font-sans">
                      {bookingError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && selectedSession && (
          <ConfirmationView
            session={selectedSession}
            selectedDate={selectedDate}
            email={user?.email ?? ""}
            onClose={handleClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BookingSheet;
