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
import { Copy, Check, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useMember, type MemberMembership } from "../hooks/useMember";
import { useMemberBookings, useManagerCancelBooking, type MemberBooking } from "../hooks/useMemberBookings";
import { useStudioContext } from "@/context/StudioContext";
import { useProducts } from "@/hooks/useProducts";
import { formatTime, formatDate } from "@/lib/timezone";
import { useNotificationLog, templateLabel } from "../hooks/useNotificationLog";

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

function getBookingPaymentLabel(b: MemberBooking): { text: string; cls: string; warn: boolean } {
  const WINDOW_MS = 24 * 60 * 60 * 1000;

  if (b.status === "confirmed") {
    if (b.membership_id) return { text: "Membership", cls: "bg-muted text-muted-foreground", warn: false };
    return { text: "Paid", cls: "bg-green-500/10 text-green-700", warn: false };
  }

  // Cancelled
  if (b.membership_id) {
    const withinWindow = b.cancelled_at && b.starts_at &&
      (new Date(b.starts_at).getTime() - new Date(b.cancelled_at).getTime()) > WINDOW_MS;
    return withinWindow
      ? { text: "Credit returned", cls: "bg-muted text-muted-foreground", warn: false }
      : { text: "No credit · after window", cls: "bg-muted text-muted-foreground", warn: false };
  }

  if (!b.payment_id) return { text: "No payment", cls: "bg-muted text-muted-foreground", warn: false };

  if (b.payment_status === "refunded") {
    return { text: "Refunded", cls: "bg-blue-500/10 text-blue-700", warn: false };
  }

  if (b.payment_status === "partially_refunded") {
    return { text: "Partial refund", cls: "bg-amber-500/10 text-amber-700", warn: true };
  }

  // Payment succeeded but not refunded — was it within the window?
  const withinWindow = b.cancelled_at && b.starts_at &&
    (new Date(b.starts_at).getTime() - new Date(b.cancelled_at).getTime()) > WINDOW_MS;

  if (withinWindow) {
    // Should have been refunded but wasn't
    return { text: "Refund failed", cls: "bg-destructive/10 text-destructive", warn: true };
  }

  return { text: "No refund · after window", cls: "bg-muted text-muted-foreground", warn: false };
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
  const { data: notifications = [] } = useNotificationLog(userId);
  const cancelBooking = useManagerCancelBooking(userId);
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const [memberTab, setMemberTab] = useState<"history" | "emails">("history");
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null);

  const now = new Date();
  const confirmBooking = allBookings.find((b) => b.id === confirmBookingId);

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
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Level</p>
                    <p className="text-base font-serif mt-1">{member.level ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Sessions</p>
                    <p className="text-base font-serif mt-1">{member.total_sessions}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">No-shows</p>
                    <p className={`text-base font-serif mt-1 ${member.no_shows > 0 ? "text-amber-600" : ""}`}>
                      {member.no_shows}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Since</p>
                    <p className="text-base font-serif mt-1">
                      {member.joined_at
                        ? new Date(member.joined_at).toLocaleDateString("nb-NO", { month: "short", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                </div>
                {member.referrals_sent > 0 && (
                  <div className="pt-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Referrals</p>
                    <p className="text-sm">
                      {member.referrals_sent} sent
                      {member.referrals_converted > 0 && (
                        <span className="text-green-700"> · {member.referrals_converted} converted</span>
                      )}
                    </p>
                  </div>
                )}
              </section>

              {/* Membership */}
              <MembershipSection membership={member.membership} />

              {/* History + Emails tabs */}
              <section className="pt-4 border-t border-border space-y-3">
                {/* Pill tabs */}
                <div className="flex gap-1 bg-muted/40 rounded-full p-1 w-fit">
                  {(["history", "emails"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMemberTab(tab)}
                      className={`text-xs px-4 py-1.5 rounded-full font-sans transition-colors capitalize ${
                        memberTab === tab
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "history" ? `History (${allBookings.length})` : `Emails (${notifications.length})`}
                    </button>
                  ))}
                </div>

                {/* History tab */}
                {memberTab === "history" && (
                  <div className="space-y-1.5">
                    {bookingsLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                    {!bookingsLoading && allBookings.length === 0 && (
                      <p className="text-sm text-muted-foreground">No bookings yet.</p>
                    )}
                    {allBookings.map((booking) => {
                      const tz = booking.location_timezone ?? studioTz;
                      const isUpcoming = booking.status === "confirmed" && new Date(booking.starts_at) > now;
                      const label = getBookingPaymentLabel(booking);
                      return (
                        <div key={booking.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className={`text-sm truncate ${booking.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}>
                                {booking.class_name}
                              </p>
                              {label.warn && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(booking.starts_at, tz, { weekday: "short", day: "numeric", month: "short" })}
                              {" · "}
                              {formatTime(booking.starts_at, tz)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-sans ${label.cls}`}>
                              {label.text}
                            </span>
                            {isUpcoming && (
                              <button
                                onClick={() => setConfirmBookingId(booking.id)}
                                disabled={cancelBooking.isPending}
                                className="text-xs px-2.5 py-1 border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Emails tab */}
                {memberTab === "emails" && (
                  <div className="space-y-1">
                    {notifications.length === 0 && (
                      <p className="text-sm text-muted-foreground">No emails sent yet.</p>
                    )}
                    {notifications.map((n) => (
                      <div key={n.id} className="flex items-center justify-between gap-2 py-1">
                        <p className="text-sm">{templateLabel(n.template)}</p>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(n.sent_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                          {" "}
                          {new Date(n.sent_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

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
