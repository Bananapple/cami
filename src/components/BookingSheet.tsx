import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClassInstances } from "@/hooks/useClassInstances";
import type { ClassInstance } from "@/hooks/useClassInstances";
import DateStrip from "@/components/booking/DateStrip";
import SessionList from "@/components/booking/SessionList";
import OrderSummary from "@/components/booking/OrderSummary";
import AuthForm from "@/components/booking/AuthForm";
import ProfileForm from "@/components/booking/ProfileForm";
import { supabase } from "@/integrations/supabase/client";
import { useStudioConfig } from "@/hooks/useStudioConfig";
import { useStudioContext } from "@/context/StudioContext";
import { useMembership } from "@/hooks/useMembership";
import { useProducts } from "@/hooks/useProducts";
import { useWaitlist } from "@/hooks/useWaitlist";
import { formatTime, formatDate } from "@/lib/timezone";

type Step = "date" | "confirm" | "auth" | "profile" | "checkout";

interface BookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string;
}

const BookingSheet = ({ isOpen, onClose, templateId }: BookingSheetProps) => {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<ClassInstance | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    discountMinor: number;
    discountedPriceMinor: number;
    label: string;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const { instances: allSessions } = useClassInstances();
  const sessions = templateId
    ? allSessions.filter((s) => s.template_id === templateId)
    : allSessions;
  const { isAuthenticated } = useAuth();
  const { studioName, location } = useStudioConfig();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const { membership } = useMembership();
  const { waitlist, join: joinWaitlist } = useWaitlist();

  const { products } = useProducts();

  // Pre-fill and auto-validate referral code when checkout step is reached
  useEffect(() => {
    if (step === "checkout" && bookingMode === "dropin" && !promoCode) {
      const savedRef = sessionStorage.getItem("brie_ref_code");
      if (savedRef) {
        setPromoCode(savedRef);
        setPromoOpen(true);
        // Auto-validate after state settles
        setTimeout(() => {
          if (!selectedSession) return;
          supabase.auth.getSession().then(({ data: { session } }) => {
            supabase.functions.invoke("validate-discount", {
              body: { code: savedRef, class_instance_id: selectedSession!.id },
              headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
            }).then(({ data }) => {
              if (data?.valid) {
                setPromoResult({ discountMinor: data.discount_minor, discountedPriceMinor: data.discounted_price_minor, label: data.label });
              }
            });
          });
        }, 50);
      }
    }
  }, [step]);

  const isFull = selectedSession
    ? selectedSession.booked_count >= selectedSession.max_capacity && selectedSession.max_capacity > 0
    : false;

  const existingWaitlistEntry = selectedSession
    ? waitlist.find((w) => w.class_instance_id === selectedSession.id)
    : null;

  const bookingMode = useMemo<"subscription" | "credit" | "dropin">(() => {
    if (!membership) return "dropin";
    const today = new Date().toISOString().split("T")[0];
    if (membership.valid_until && membership.valid_until < today) return "dropin";
    if (membership.credits_remaining === null) return "subscription";
    if (membership.credits_remaining > 0) return "credit";
    return "dropin";
  }, [membership]);

  // Auto-derive upsell: find the best-value clip card and compute saving vs drop-in price
  const upsell = useMemo(() => {
    if (bookingMode !== "dropin" || !selectedSession) return null;
    const clipCards = products.filter(p => p.type === "clip_card" && p.credits && p.credits > 0);
    if (!clipCards.length) return null;
    const best = clipCards.reduce((a, b) =>
      a.price_minor / a.credits <= b.price_minor / b.credits ? a : b
    );
    const dropInOre = (selectedSession.price ?? 250) * 100;
    const perCreditOre = best.price_minor / best.credits;
    const savingNOK = Math.round((dropInOre - perCreditOre) / 100);
    if (savingNOK <= 0) return null;
    return { credits: best.credits, savingNOK };
  }, [bookingMode, selectedSession, products]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("date");
      setSelectedSession(null);
      setCheckoutError(null);
      setWaitlistJoined(false);
      setPromoCode("");
      setPromoOpen(false);
      setPromoResult(null);
      setPromoError(null);
    }, 300);
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim() || !selectedSession) return;
    setPromoValidating(true);
    setPromoResult(null);
    setPromoError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("validate-discount", {
        body: { code: promoCode.trim(), class_instance_id: selectedSession.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error || !data) { setPromoError("Could not validate code."); return; }
      if (!data.valid) { setPromoError("Invalid or expired code."); return; }
      setPromoResult({
        discountMinor: data.discount_minor,
        discountedPriceMinor: data.discounted_price_minor,
        label: data.label,
      });
    } catch {
      setPromoError("Could not validate code.");
    } finally {
      setPromoValidating(false);
    }
  };

  const handleSelectSession = (session: ClassInstance) => {
    setSelectedSession(session);
    setStep("confirm");
  };

  const handleContinueFromConfirm = async () => {
    // Single getUser() call as the authoritative auth check — avoids TOCTOU race
    // where a stale isAuthenticated flag could diverge from the actual session state.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStep("auth"); return; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    setStep(profile?.full_name ? "checkout" : "profile");
  };

  const handleAuthSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStep("checkout"); return; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    setStep(profile?.full_name ? "checkout" : "profile");
  };

  const handleCheckout = async () => {
    if (!selectedSession) return;
    setCheckoutError(null);
    setCheckoutLoading(true);

    // Waitlist join path
    if (isFull) {
      try {
        await joinWaitlist.mutateAsync(selectedSession.id);
        setWaitlistJoined(true);
      } catch (err: any) {
        const msg: string = err.message ?? "";
        if (msg.includes("exclusion constraint")) {
          // Already on waitlist — treat as success
          setWaitlistJoined(true);
        } else {
          setCheckoutError("Unable to join the waitlist. Please try again.");
        }
      } finally {
        setCheckoutLoading(false);
      }
      return;
    }

    // Normal booking path
    try {
      const returnUrl = window.location.origin;
      const { data: { session } } = await supabase.auth.getSession();
      const trimmedCode = promoCode.trim().toUpperCase() || undefined;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          class_instance_id: selectedSession.id,
          return_url: returnUrl,
          ...(trimmedCode ? { discount_code: trimmedCode } : {}),
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (trimmedCode) sessionStorage.removeItem("brie_ref_code");

      // Free booking (active membership covered the class)
      if (data?.booking_id && !data?.checkout_url) {
        window.location.href = `${returnUrl}?booking_id=${data.booking_id}&status=success`;
        return;
      }

      if (error || !data?.checkout_url) {
        let message = data?.error ?? "Unable to start checkout. Please try again.";
        if (error?.context) {
          try { const body = await error.context.json(); message = body.error ?? message; } catch { /* ignore JSON parse error */ }
        } else if (error?.message) {
          message = error.message;
        }
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
      case "profile": setStep("auth"); break;
      case "checkout": setStep("confirm"); break;
    }
  };

  const stepLabel = () => {
    switch (step) {
      case "date":     return "Select a Date";
      case "confirm":  return "Session Details";
      case "auth":     return "Sign In";
      case "profile":  return "Your Details";
      case "checkout": return isFull ? "Join Waitlist" : bookingMode === "dropin" ? "Payment" : "Confirm Booking";
    }
  };

  const showBack = step !== "date";
  const showSplitLayout = step === "auth" || step === "profile" || step === "checkout";

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
                  {formatDate(selectedSession.starts_at, selectedSession.location_timezone ?? studioTz, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {formatTime(selectedSession.starts_at, selectedSession.location_timezone ?? studioTz)}
                </p>
                <p>📍 {selectedSession.location}</p>
                <p>
                  {Math.round(
                    (new Date(selectedSession.ends_at).getTime() - new Date(selectedSession.starts_at).getTime()) / 60000
                  )} min · {selectedSession.level}
                </p>
              </div>
            </div>

            {isFull ? (
              <div className="py-3 border-y border-border">
                <p className="text-sm font-sans text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-md px-3 py-2">
                  This class is full. You can join the waitlist and we'll notify you if a spot opens up.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between py-3 border-y border-border">
                {bookingMode === "subscription" && (
                  <>
                    <span className="text-sm text-muted-foreground font-sans">{membership?.plan_name}</span>
                    <span className="text-lg font-serif text-foreground">Included</span>
                  </>
                )}
                {bookingMode === "credit" && (
                  <>
                    <span className="text-sm text-muted-foreground font-sans">
                      Clip card · {membership?.credits_remaining} credit{membership?.credits_remaining !== 1 ? "s" : ""} remaining
                    </span>
                    <span className="text-lg font-serif text-foreground">1 credit</span>
                  </>
                )}
                {bookingMode === "dropin" && (
                  <>
                    <span className="text-sm text-muted-foreground font-sans">Drop-in</span>
                    <span className="text-lg font-serif text-foreground">
                      kr {(selectedSession.price ?? 250).toLocaleString("nb-NO")}
                    </span>
                  </>
                )}
              </div>
            )}

            {existingWaitlistEntry ? (
              <div className="w-full py-3.5 bg-muted text-foreground/70 text-sm font-sans text-center rounded-lg">
                You're already on the waitlist for this class
              </div>
            ) : (
              <button
                onClick={handleContinueFromConfirm}
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
              >
                {isFull ? "Join Waitlist →" : bookingMode === "dropin" ? "Continue to Checkout →" : "Book Class →"}
              </button>
            )}

            {!isFull && (
              <p className="text-xs text-center text-muted-foreground font-serif">
                Already a member?{" "}
                <button onClick={() => setStep("auth")} className="text-primary hover:underline">
                  Log in
                </button>
              </p>
            )}

            {upsell && (
              <p className="text-xs text-center text-muted-foreground font-sans">
                Save kr {upsell.savingNOK}/class with a{" "}
                <a href="/joinnow" className="text-primary hover:underline">
                  {upsell.credits}× clip card →
                </a>
              </p>
            )}
          </div>
        )}

        {/* Split layout: Auth + Checkout steps */}
        {showSplitLayout && selectedSession && (
          <div className="flex flex-col sm:flex-row min-h-[calc(100vh-60px)]">
            {/* Left: Order Summary */}
            <div className="sm:w-[45%] p-6 flex-shrink-0">
              <OrderSummary
                session={selectedSession}
                selectedDate={selectedDate}
                bookingMode={bookingMode}
                planName={membership?.plan_name}
                creditsRemaining={membership?.credits_remaining}
                discountMinor={promoResult?.discountMinor}
                discountLabel={promoResult?.label}
              />
            </div>

            {/* Right: Auth form or Checkout CTA */}
            <div className="flex-1 p-6 bg-background border-t sm:border-t-0 sm:border-l border-border">
              {step === "auth" && <AuthForm onSuccess={handleAuthSuccess} />}

              {step === "profile" && <ProfileForm onSuccess={() => setStep("checkout")} />}

              {step === "checkout" && (
                <div className="space-y-6">
                  {waitlistJoined ? (
                    <div className="space-y-4 py-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                        <span className="text-green-600 text-xl">✓</span>
                      </div>
                      <h3 className="text-lg font-serif text-foreground">You're on the waitlist</h3>
                      <p className="text-sm text-muted-foreground font-sans">
                        We'll let you know as soon as a spot opens up. You can manage your waitlist from your dashboard.
                      </p>
                      <button
                        onClick={handleClose}
                        className="w-full border border-border rounded-lg py-3 text-sm font-sans text-foreground/70 hover:bg-muted transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-serif text-foreground">
                          {isFull ? "Join the waitlist" : "Ready to book?"}
                        </h3>
                        <p className="text-sm text-muted-foreground font-sans mt-1">
                          {isFull
                            ? "We'll notify you by email when a spot opens up."
                            : bookingMode === "dropin"
                            ? "You'll be taken to our secure payment page to complete your booking."
                            : "Your membership covers this class. Click below to confirm your spot."}
                        </p>
                      </div>

                      <div className="bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground font-sans space-y-1">
                        <p>· {selectedSession.class_name}</p>
                        <p>· {selectedDate.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}</p>
                        {!isFull && (
                          <p>
                            {bookingMode === "dropin" ? (
                              promoResult?.discountMinor ? (
                                <>
                                  <span className="line-through text-muted-foreground/50 mr-1">
                                    kr {(selectedSession.price ?? 250).toLocaleString("nb-NO")}
                                  </span>
                                  <span className="text-foreground font-medium">
                                    kr {(promoResult.discountedPriceMinor / 100).toLocaleString("nb-NO")}
                                  </span>
                                </>
                              ) : `kr ${(selectedSession.price ?? 250).toLocaleString("nb-NO")}`
                            ) : bookingMode === "subscription"
                              ? `Included with ${membership?.plan_name ?? "membership"}`
                              : "1 credit"}
                          </p>
                        )}
                      </div>

                      {bookingMode === "dropin" && !isFull && (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPromoOpen((o) => !o);
                              setPromoResult(null);
                              setPromoError(null);
                              if (promoOpen) setPromoCode("");
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground font-sans underline-offset-2 hover:underline transition-colors"
                          >
                            {promoOpen ? "Remove promo code" : "Have a promo code?"}
                          </button>
                          {promoOpen && (
                            <div className="space-y-1.5">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={promoCode}
                                  onChange={(e) => {
                                    setPromoCode(e.target.value.toUpperCase());
                                    setPromoResult(null);
                                    setPromoError(null);
                                  }}
                                  onKeyDown={(e) => e.key === "Enter" && applyPromoCode()}
                                  placeholder="ENTER CODE"
                                  className="flex-1 px-3 py-2 text-sm font-sans bg-muted border border-border rounded-lg placeholder:text-muted-foreground/50 uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={applyPromoCode}
                                  disabled={promoValidating || !promoCode.trim()}
                                  className="px-3 py-2 text-xs font-sans bg-foreground text-background rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity shrink-0"
                                >
                                  {promoValidating ? "…" : "Apply"}
                                </button>
                              </div>
                              {promoResult && (
                                <p className="text-xs text-green-600 font-sans">
                                  ✓ {promoResult.label} applied
                                </p>
                              )}
                              {promoError && (
                                <p className="text-xs text-destructive font-sans">{promoError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleCheckout}
                        disabled={checkoutLoading}
                        className="w-full bg-primary hover:bg-primary/80 disabled:opacity-60 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
                      >
                        {checkoutLoading
                          ? (isFull ? "Joining waitlist…" : bookingMode === "dropin" ? "Preparing checkout…" : "Booking…")
                          : (isFull ? "Join Waitlist →" : bookingMode === "dropin" ? "Pay now →" : "Confirm Booking →")}
                      </button>

                      {checkoutError && (
                        <p className="text-sm text-destructive text-center font-sans">
                          {checkoutError}
                        </p>
                      )}

                      <p className="text-xs text-center text-muted-foreground font-sans">
                        {isFull
                          ? "You can leave the waitlist at any time from your dashboard."
                          : bookingMode === "dropin"
                          ? "Secure payment · 24-hour free cancellation"
                          : "24-hour free cancellation"}
                      </p>
                    </>
                  )}
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
