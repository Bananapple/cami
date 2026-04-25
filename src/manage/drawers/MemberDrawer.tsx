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
import { toast } from "sonner";
import { useMember } from "../hooks/useMember";
import { useMemberBookings, useManagerCancelBooking } from "../hooks/useMemberBookings";
import { useStudioContext } from "@/context/StudioContext";
import { formatTime, formatDate } from "@/lib/timezone";

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
  const { data: bookings = [], isLoading: bookingsLoading } = useMemberBookings(userId);
  const cancelBooking = useManagerCancelBooking(userId);
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null);
  const confirmBooking = bookings.find((b) => b.id === confirmBookingId);

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
              <section className="space-y-1">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Contact</h3>
                <p className="text-sm">{member.email ?? "—"}</p>
                <p className="text-sm">{member.phone_number ?? "—"}</p>
              </section>

              <section className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Level</p>
                  <p className="text-base font-serif mt-1">{member.level ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Sessions</p>
                  <p className="text-base font-serif mt-1">{member.total_sessions}</p>
                </div>
              </section>

              <section className="pt-4 border-t border-border space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                  Upcoming Bookings
                </h3>

                {bookingsLoading && (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}

                {!bookingsLoading && bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
                )}

                {bookings.map((booking) => {
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

              <section className="space-y-2 pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="text-sm py-2 border border-border rounded-md hover:bg-muted transition-colors"
                    disabled
                  >
                    Sell package
                  </button>
                  <button
                    className="text-sm py-2 border border-border rounded-md hover:bg-muted transition-colors"
                    disabled
                  >
                    Book class
                  </button>
                </div>
                <p className="text-xs text-muted-foreground italic pt-1">
                  Additional actions coming in V2.
                </p>
              </section>
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
