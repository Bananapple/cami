import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useBookings } from "@/hooks/useBookings";
import { useMembership } from "@/hooks/useMembership";
import { useStudioMember } from "@/hooks/useStudioMember";
import { useWaitlist } from "@/hooks/useWaitlist";
import { useState, useRef, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";
import { LogOut, CreditCard, User, X, Copy, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime, formatDate } from "@/lib/timezone";
import { googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const { profile } = useProfile();
  const { bookings, cancelBooking, error: bookingsError } = useBookings();
  const { membership } = useMembership();
  const { studioMember } = useStudioMember();
  const { waitlist, leave: leaveWaitlist } = useWaitlist();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const [bookingOpen, setBookingOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; startsAt: string; hasMembership: boolean } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-serif">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    toast("Logged out successfully.");
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget) return;
    const result = await cancelBooking.mutateAsync(cancelTarget.id);
    setCancelTarget(null);
    if (result?.refunded) {
      toast(`Booking cancelled. A refund of NOK ${result.refund_amount} is on its way.`);
    } else if (result?.credit_returned) {
      toast("Booking cancelled. Your credit has been returned.");
    } else if (result?.reason === "inside_cancellation_window") {
      toast(cancelTarget.hasMembership
        ? "Booking cancelled. Credit not returned — cancellation is within 24 hours of class."
        : "Booking cancelled. No refund — cancellation is within 24 hours of class.");
    } else if (result?.reason === "refund_failed") {
      toast("Booking cancelled. Refund could not be processed automatically — we'll follow up.");
    } else {
      toast("Booking cancelled.");
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 lg:gap-12">
          {/* Left Sidebar */}
          <div className="bg-header rounded-xl p-8 space-y-8 h-fit">
            {/* Avatar */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-2xl font-serif text-primary">
                  {profile?.avatar_initials || user?.email?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <div>
                <p className="text-sm text-foreground/60 font-sans">{greeting()},</p>
                <p className="text-xl font-serif text-foreground">
                  {profile?.full_name || "Friend"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 text-sm font-sans text-foreground/70 hover:text-foreground transition-colors">
                <User className="w-4 h-4" />
                Edit Profile
              </button>
              <button className="w-full flex items-center gap-3 text-sm font-sans text-foreground/70 hover:text-foreground transition-colors">
                <CreditCard className="w-4 h-4" />
                Manage Cards
              </button>
            </div>

            {/* Stats */}
            <div className="border-t border-border/50 pt-6 space-y-4">
              <div>
                <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/50">Level</p>
                <p className="text-lg font-serif text-foreground">{studioMember?.level || "STARTER"}</p>
              </div>
              <div>
                <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/50">Sessions</p>
                <p className="text-lg font-serif text-foreground">{studioMember?.total_sessions ?? 0}</p>
              </div>
            </div>

            <div className="border-t border-border/50 pt-6">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 border border-border rounded-lg text-sm font-sans text-foreground/70 hover:text-foreground hover:bg-background/50 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            <h1 className="text-3xl font-serif text-foreground">Dashboard</h1>

            {/* Upcoming Sessions */}
            <div className="bg-card rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-serif text-foreground">Upcoming Sessions</h2>

              {bookingsError ? (
                <p className="text-sm text-destructive font-sans py-4">
                  Failed to load bookings. Please refresh.
                </p>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground font-serif py-4">
                  No upcoming sessions. Book your first class!
                </p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking: any) => {
                    const ci = booking.class_instances;
                    const locationTz = ci?.locations?.timezone ?? null;
                    const tz = locationTz ?? studioTz;
                    const isRefundPending = booking.status === "cancelled" && booking.payments?.status === "succeeded";
                    return (
                    <div
                      key={booking.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${isRefundPending ? "border-muted bg-muted/20 opacity-70" : "border-border"}`}
                    >
                      <div className="text-center min-w-[50px]">
                        <p className="text-xs font-sans font-medium uppercase text-muted-foreground">
                          {ci?.starts_at ? formatDate(ci.starts_at, tz, { weekday: "short" }) : "—"}
                        </p>
                        <p className="text-lg font-serif text-foreground">
                          {ci?.starts_at ? new Date(ci.starts_at).toLocaleDateString("en-CA", { timeZone: tz }).split("-")[2] : "—"}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-serif text-foreground">
                          {ci?.class_templates?.name ?? "Class"}
                        </p>
                        {isRefundPending ? (
                          <p className="text-xs text-muted-foreground font-sans">
                            Cancelled · Refund of kr {booking.payments?.amount} on its way (3–5 business days)
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground font-sans">
                            {ci?.starts_at ? formatTime(ci.starts_at, tz) : ""}
                            {ci?.class_templates?.default_duration_minutes ? ` · ${ci.class_templates.default_duration_minutes} min` : ""}
                          </p>
                        )}
                      </div>
                      {!isRefundPending && (
                        <div className="flex items-center gap-1">
                          {ci?.starts_at && ci?.ends_at && (
                            <CalendarMenu
                              title={ci.class_templates?.name ?? "Yoga class"}
                              startsAt={ci.starts_at}
                              endsAt={ci.ends_at}
                              location={ci.locations?.name}
                            />
                          )}
                          <button
                            onClick={() => setCancelTarget({
                              id: booking.id,
                              startsAt: ci?.starts_at ?? "",
                              hasMembership: !!booking.membership_id,
                            })}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Cancel booking"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all"
              >
                Book a Session
              </button>
            </div>

            {/* Waitlist */}
            {waitlist.length > 0 && (
              <div className="bg-card rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-serif text-foreground">Waitlist</h2>
                <div className="space-y-3">
                  {waitlist.map((entry) => {
                    const ci = entry.class_instances;
                    const tz = ci?.locations?.timezone ?? studioTz;
                    const startsAt = ci?.starts_at ? new Date(ci.starts_at) : null;
                    const isOffered = entry.status === "offered";
                    const offerExpires = entry.offer_expires_at ? new Date(entry.offer_expires_at) : null;

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border ${
                          isOffered ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" : "border-border"
                        }`}
                      >
                        {startsAt && (
                          <div className="text-center min-w-[50px]">
                            <p className="text-xs font-sans font-medium uppercase text-muted-foreground">
                              {formatDate(ci!.starts_at, tz, { weekday: "short" })}
                            </p>
                            <p className="text-lg font-serif text-foreground">
                              {startsAt.toLocaleDateString("en-CA", { timeZone: tz }).split("-")[2]}
                            </p>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-serif text-foreground">
                            {ci?.class_templates?.name ?? "Class"}
                          </p>
                          {startsAt && (
                            <p className="text-xs text-muted-foreground font-sans mt-0.5">
                              {formatTime(ci!.starts_at, tz)}
                            </p>
                          )}
                          {isOffered && (
                            <p className="text-xs font-sans text-amber-700 dark:text-amber-400 mt-1">
                              Spot available!{offerExpires ? ` Accept before ${offerExpires.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}` : ""}
                            </p>
                          )}
                          {!isOffered && (
                            <p className="text-xs text-muted-foreground font-sans mt-0.5">Waiting for a spot</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {isOffered && (
                            <button
                              onClick={() => setBookingOpen(true)}
                              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-sans hover:bg-primary/80 transition-colors"
                            >
                              Book now
                            </button>
                          )}
                          <button
                            onClick={() => leaveWaitlist.mutate(entry.id, {
                              onError: () => toast("Failed to leave waitlist."),
                              onSuccess: () => toast("Removed from waitlist."),
                            })}
                            className="text-xs px-3 py-1.5 border border-border rounded-md text-muted-foreground font-sans hover:text-foreground transition-colors"
                          >
                            Leave
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Membership */}
            <div className="bg-card rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-serif text-foreground">Membership</h2>

              {membership ? (
                <div className="space-y-3">
                  <p className="text-sm font-serif text-foreground">{membership.plan_name}</p>
                  <div className="space-y-2 text-xs text-muted-foreground font-sans">
                    {membership.credits_remaining !== null && (
                      <p>◈ {membership.credits_remaining} credit{membership.credits_remaining !== 1 ? "s" : ""} remaining</p>
                    )}
                    {membership.valid_until && (
                      <p>◷ Valid until {new Date(membership.valid_until).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}</p>
                    )}
                    {membership.renewal_days && (
                      <p>↻ Renews every {membership.renewal_days} days</p>
                    )}
                    <p>✕ Cancel anytime easily from your account</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-serif">
                    No active membership. Become a member for the best rates.
                  </p>
                  <Link
                    to="/joinnow"
                    className="block w-full text-center bg-primary hover:bg-primary/80 text-primary-foreground py-3 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all"
                  >
                    Become a Member
                  </Link>
                </div>
              )}
            </div>

            {/* Referral link — only show when the program is active */}
            {studioMember?.referral_code && studioCtx?.studio?.referral_enabled && (() => {
              const referralEnabled = studioCtx?.studio?.referral_enabled;
              const referralPct = (studioCtx?.studio as any)?.referral_discount_percent;
              return (
                <div className="bg-card rounded-xl p-6 space-y-3">
                  <h2 className="text-lg font-serif text-foreground">Invite a Friend</h2>
                  <p className="text-sm text-muted-foreground font-serif">
                    {referralEnabled && referralPct
                      ? `Share your link — your friend gets ${referralPct}% off their first class.`
                      : "Share your link and invite friends to try a class."}
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={`${window.location.origin}?ref=${studioMember.referral_code}`}
                      className="flex-1 text-xs font-sans bg-muted rounded-lg px-3 py-2.5 text-foreground/70 truncate border border-border"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}?ref=${studioMember.referral_code}`);
                        toast("Link copied to clipboard!");
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-primary text-primary-foreground text-xs font-sans rounded-lg hover:bg-primary/80 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* FAQ link */}
            <p className="text-sm text-muted-foreground font-serif text-center">
              Want to know more?{" "}
              <Link to="/joinnow" className="text-primary hover:underline">
                Read our FAQ
              </Link>
            </p>
          </div>
        </div>
      </div>

      <Footer />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />

      {/* Cancel booking confirmation dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (() => {
                const startsAt = new Date(cancelTarget.startsAt);
                const hoursUntil = (startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
                const insideWindow = hoursUntil < 24;
                if (insideWindow) {
                  return cancelTarget.hasMembership
                    ? "This class starts in less than 24 hours. Your credit will not be returned."
                    : "This class starts in less than 24 hours. No refund will be issued.";
                }
                return cancelTarget.hasMembership
                  ? "Your credit will be returned to your membership."
                  : "A full refund will be issued to your original payment method.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function CalendarMenu({ title, startsAt, endsAt, location }: {
  title: string; startsAt: string; endsAt: string; location?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const calArgs = { title, startsAt, endsAt, location };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Add to calendar"
      >
        <CalendarPlus className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 bg-card border border-border rounded-lg shadow-md py-1 w-48 text-sm">
          <a
            href={googleCalendarUrl(calArgs)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-foreground no-underline"
            onClick={() => setOpen(false)}
          >
            <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
            Google Calendar
          </a>
          <a
            href={icsDataUrl(calArgs)}
            download="class.ics"
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-foreground no-underline"
            onClick={() => setOpen(false)}
          >
            <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
            Apple / Outlook
          </a>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
