import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useBookings } from "@/hooks/useBookings";
import { useMembership } from "@/hooks/useMembership";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";
import { LogOut, CreditCard, User, X } from "lucide-react";
import { toast } from "sonner";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime, formatDate } from "@/lib/timezone";

const Dashboard = () => {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const { profile } = useProfile();
  const { bookings, cancelBooking } = useBookings();
  const { membership } = useMembership();
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const [bookingOpen, setBookingOpen] = useState(false);

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

  const handleCancelBooking = async (id: string) => {
    const result = await cancelBooking.mutateAsync(id);
    if (result?.refunded) {
      toast(`Booking cancelled. A refund of NOK ${result.refund_amount} is on its way.`);
    } else if (result?.reason === "inside_cancellation_window") {
      toast("Booking cancelled. No refund — cancellation is within 24 hours of class.");
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
                <p className="text-lg font-serif text-foreground">{profile?.level || "STARTER"}</p>
              </div>
              <div>
                <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/50">Sessions</p>
                <p className="text-lg font-serif text-foreground">{profile?.total_sessions ?? 0}</p>
              </div>
              <div>
                <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/50">Referrals</p>
                <p className="text-lg font-serif text-foreground">{profile?.referrals ?? 0}</p>
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

              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground font-serif py-4">
                  No upcoming sessions. Book your first class!
                </p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking: any) => {
                    const ci = booking.class_instances;
                    const locationTz = ci?.locations?.timezone ?? null;
                    const tz = locationTz ?? studioTz;
                    return (
                    <div
                      key={booking.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border"
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
                        <p className="text-xs text-muted-foreground font-sans">
                          {ci?.starts_at ? formatTime(ci.starts_at, tz) : ""}
                          {ci?.class_templates?.default_duration_minutes ? ` · ${ci.class_templates.default_duration_minutes} min` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Cancel booking"
                      >
                        <X className="w-4 h-4" />
                      </button>
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

            {/* Membership */}
            <div className="bg-card rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-serif text-foreground">Membership</h2>

              {membership ? (
                <div className="space-y-3">
                  <p className="text-sm font-serif text-foreground">{membership.plan_name}</p>
                  <div className="space-y-2 text-xs text-muted-foreground font-sans">
                    <p>↻ Automatic renewal every {membership.renewal_days} days</p>
                    <p>✕ Cancel anytime easily from your account</p>
                    <p>$ Get the best deal — book your spot at best price</p>
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
    </div>
  );
};

export default Dashboard;
