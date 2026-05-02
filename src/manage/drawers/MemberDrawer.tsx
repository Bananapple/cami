import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useMember, type MemberMembership } from "../hooks/useMember";
import { useMemberBookings, useManagerCancelBooking } from "../hooks/useMemberBookings";
import { useStudioContext } from "@/context/StudioContext";
import { useProducts } from "@/hooks/useProducts";
import { formatTime, formatDate } from "@/lib/timezone";
import { inSegment, SEGMENTS, type MemberSummary } from "../hooks/useClientsView";

function MembershipSection({ membership }: { membership: MemberMembership | null }) {
  if (!membership) {
    return (
      <section className="pt-4 border-t border-border">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Membership</h3>
        <p className="text-sm text-muted-foreground">No active plan</p>
      </section>
    );
  }

  const isSubscription = membership.plan_type === "subscription";
  const creditsLabel = isSubscription
    ? "Unlimited"
    : membership.credits_remaining !== null
      ? `${membership.credits_remaining} credit${membership.credits_remaining !== 1 ? "s" : ""} remaining`
      : "—";

  const validUntilLabel = membership.valid_until
    ? new Date(membership.valid_until).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <section className="pt-4 border-t border-border space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Membership</h3>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">{membership.plan_name}</p>
          <p className="text-xs text-muted-foreground">{creditsLabel}</p>
          {validUntilLabel && (
            <p className="text-xs text-muted-foreground">Valid until {validUntilLabel}</p>
          )}
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
          isSubscription
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        }`}>
          {isSubscription ? "Active" : "Clip card"}
        </span>
      </div>
    </section>
  );
}

function SellPackageSection({ userId }: { userId: string }) {
  const { products } = useProducts();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const purchasableProducts = products.filter(
    (p) => p.type !== "drop_in" && p.type !== "addon"
  );

  const handleCopy = (productId: string) => {
    const url = `${window.location.origin}/joinnow?product=${productId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied — share with member");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="space-y-2 pt-4 border-t border-border">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Actions</h3>
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between text-sm py-2 px-3 border border-border rounded-md hover:bg-muted transition-colors"
        >
          <span>Sell package</span>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        {open && (
          <div className="mt-2 border border-border rounded-md overflow-hidden divide-y divide-border">
            {purchasableProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No products available.</p>
            ) : (
              purchasableProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
                  <div>
                    <p className="text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      kr {(p.price_minor / 100).toLocaleString("nb-NO")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(p.id)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    Copy link
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function MemberDrawer({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: member, isLoading } = useMember(userId);
  const { data: allBookings = [], isLoading: bookingsLoading } = useMemberBookings(userId);
  const cancelBooking = useManagerCancelBooking(userId);
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null);

  const now = new Date();
  const upcomingBookings = allBookings.filter(
    (b) => b.status === "confirmed" && new Date(b.starts_at) > now
  );
  const pastBookings = allBookings.filter(
    (b) => b.status === "cancelled" || new Date(b.starts_at) <= now
  );

  const confirmBooking = upcomingBookings.find((b) => b.id === confirmBookingId);

  // Compute smart audience segment for this member
  const lastConfirmedPast = allBookings
    .filter((b) => b.status === "confirmed" && new Date(b.starts_at) <= now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];

  const memberSnapshot: MemberSummary | null = member
    ? {
        studio_member_id: "",
        user_id: member.user_id,
        full_name: member.full_name,
        email: member.email,
        phone_number: member.phone_number,
        total_sessions: member.total_sessions,
        level: member.level,
        joined_at: member.joined_at ?? new Date().toISOString(),
        membership_id: member.membership?.id ?? null,
        membership_status: member.membership ? "active" : null,
        credits_remaining: member.membership?.credits_remaining ?? null,
        valid_until: member.membership?.valid_until ?? null,
        plan_name: member.membership?.plan_name ?? null,
        plan_type: member.membership?.plan_type ?? null,
        last_booking_at: lastConfirmedPast?.starts_at ?? null,
      }
    : null;

  const activeSegment = memberSnapshot
    ? SEGMENTS.filter((s) => s.key !== "all").find((s) => inSegment(memberSnapshot, s.key))
    : null;

  const handleConfirmCancel = async () => {
    if (!confirmBookingId) return;
    setConfirmBookingId(null);
    try {
      const result = await cancelBooking.mutateAsync(confirmBookingId);
      if (result.refunded) {
        toast.success(`Booking cancelled. Refund of NOK ${result.refund_amount} issued.`);
      } else if (result.reason === "inside_cancellation_window") {
        toast("Booking cancelled. No refund — inside cancellation window.");
      } else if (result.reason === "no_payment") {
        toast("Booking cancelled. No payment on record.");
      } else if (result.reason === "refund_failed") {
        toast.warning("Booking cancelled but refund failed. Follow up manually.");
      } else {
        toast("Booking cancelled.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Could not cancel booking.");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl">
              {isLoading ? "Loading..." : member?.full_name ?? "Member"}
            </SheetTitle>
          </SheetHeader>

          {!isLoading && member && (
            <div className="mt-6 space-y-6">
              {/* Contact */}
              <section className="space-y-1">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Contact</h3>
                <p className="text-sm">{member.email ?? "—"}</p>
                <p className="text-sm">{member.phone_number ?? "—"}</p>
              </section>

              {/* Stats */}
              <section className="pt-4 border-t border-border space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Level</p>
                    <p className="text-base font-serif mt-1">{member.level ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Sessions</p>
                    <p className="text-base font-serif mt-1">{member.total_sessions}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Member since</p>
                    <p className="text-base font-serif mt-1">
                      {member.joined_at
                        ? new Date(member.joined_at).toLocaleDateString("nb-NO", { month: "short", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                </div>
                {activeSegment && (
                  <div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground">
                      {activeSegment.label}
                    </span>
                  </div>
                )}
              </section>

              {/* Membership */}
              <MembershipSection membership={member.membership} />

              {/* Upcoming bookings */}
              <section className="pt-4 border-t border-border space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                  Upcoming Bookings
                </h3>

                {bookingsLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

                {!bookingsLoading && upcomingBookings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
                )}

                {upcomingBookings.map((booking) => {
                  const tz = booking.location_timezone ?? studioTz;
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-serif truncate">{booking.class_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(booking.starts_at, tz, { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {formatTime(booking.starts_at, tz)}
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmBookingId(booking.id)}
                        disabled={cancelBooking.isPending}
                        className="text-xs px-3 py-1.5 border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        Cancel & Refund
                      </button>
                    </div>
                  );
                })}
              </section>

              {/* Past bookings (collapsible) */}
              {!bookingsLoading && pastBookings.length > 0 && (
                <section className="pt-2 space-y-2">
                  <button
                    onClick={() => setHistoryOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {historyOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    History ({pastBookings.length})
                  </button>

                  {historyOpen && (
                    <div className="space-y-1.5">
                      {pastBookings.map((booking) => {
                        const tz = booking.location_timezone ?? studioTz;
                        const isCancelled = booking.status === "cancelled";
                        return (
                          <div key={booking.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${isCancelled ? "text-muted-foreground line-through" : ""}`}>
                                {booking.class_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(booking.starts_at, tz, { weekday: "short", day: "numeric", month: "short" })}
                                {" · "}
                                {formatTime(booking.starts_at, tz)}
                              </p>
                            </div>
                            {isCancelled && (
                              <span className="text-xs text-muted-foreground shrink-0">Cancelled</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Sell package */}
              <SellPackageSection userId={userId} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmBookingId} onOpenChange={(o) => !o && setConfirmBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBooking && (
                <>
                  <strong>{confirmBooking.class_name}</strong>
                  {" on "}
                  {formatDate(confirmBooking.starts_at, confirmBooking.location_timezone ?? studioTz, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  {" at "}
                  {formatTime(confirmBooking.starts_at, confirmBooking.location_timezone ?? studioTz)}
                  .
                  <br /><br />
                  If the class is more than 24 hours away and a payment exists, a full refund will
                  be issued automatically. Otherwise the booking is cancelled with no refund.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel & Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
