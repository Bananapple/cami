import type { StateBadgeTone } from "../components/Badge";

// DATA-3: backend codes like `payment_failed` and `no_show` must never reach
// the UI raw. Every surface that renders a booking status maps through this
// table to get { tone, label }.

export type BookingStatusCode =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "payment_failed"
  | "no_show"
  | "completed";

// Derived/UI-only labels. Used by Today + Activity rows when we want to
// distinguish e.g. "Booked" (confirmed + future) from "Attended" (confirmed
// + checked-in) from "No-show" (confirmed + past + not checked in).
export type DerivedStatus =
  | "booked"
  | "attended"
  | "no_show_derived"
  | "credit_returned"
  | "credit_no_return"
  | "refunded"
  | "partial_refund"
  | "refund_failed"
  | "no_refund_after_window"
  | "no_payment";

const RAW: Record<BookingStatusCode, { tone: StateBadgeTone; label: string }> = {
  pending: { tone: "neutral", label: "Pending" },
  confirmed: { tone: "good", label: "Confirmed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  payment_failed: { tone: "warn", label: "Payment failed" },
  no_show: { tone: "bad", label: "No-show" },
  completed: { tone: "good", label: "Attended" },
};

const DERIVED: Record<DerivedStatus, { tone: StateBadgeTone; label: string }> = {
  booked: { tone: "good", label: "Booked" },
  attended: { tone: "good", label: "Attended" },
  no_show_derived: { tone: "warn", label: "No-show" },
  credit_returned: { tone: "neutral", label: "Credit returned" },
  credit_no_return: { tone: "neutral", label: "No credit" },
  refunded: { tone: "info", label: "Refunded" },
  partial_refund: { tone: "warn", label: "Partial refund" },
  refund_failed: { tone: "bad", label: "Refund failed" },
  no_refund_after_window: { tone: "neutral", label: "No refund" },
  no_payment: { tone: "neutral", label: "No payment" },
};

/** Look up the badge config for a raw backend status code. */
export function bookingStatusBadge(code: string): { tone: StateBadgeTone; label: string } {
  return (RAW as any)[code] ?? { tone: "neutral", label: titleCase(code) };
}

/** Look up the badge config for a derived/UI status. */
export function derivedStatusBadge(status: DerivedStatus): { tone: StateBadgeTone; label: string } {
  return DERIVED[status];
}

/**
 * Compute the right derived status for a booking row based on its status,
 * payment, membership, checked_in_at, and starts_at. Single source of truth
 * used by Today + MemberDrawer Activity + anywhere else that needs to render
 * the trailing badge for a booking.
 */
export function deriveBookingStatus(b: {
  status: string;
  starts_at: string | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  payment_id: string | null;
  membership_id: string | null;
  payment_status: string | null;
}): DerivedStatus | BookingStatusCode {
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const startMs = b.starts_at ? new Date(b.starts_at).getTime() : 0;
  const isPast = startMs > 0 && startMs < Date.now();

  if (b.status === "confirmed") {
    if (b.checked_in_at) return "attended";
    if (isPast) return "no_show_derived";
    return "booked";
  }

  if (b.status === "payment_failed") return "payment_failed";
  if (b.status === "pending") return "pending";

  // Cancelled paths
  if (b.status === "cancelled") {
    if (b.membership_id) {
      const within =
        b.cancelled_at && b.starts_at && startMs - new Date(b.cancelled_at).getTime() > WINDOW_MS;
      return within ? "credit_returned" : "credit_no_return";
    }
    if (!b.payment_id) return "no_payment";
    if (b.payment_status === "refunded") return "refunded";
    if (b.payment_status === "partially_refunded") return "partial_refund";

    const within =
      b.cancelled_at && b.starts_at && startMs - new Date(b.cancelled_at).getTime() > WINDOW_MS;
    if (within) return "refund_failed";
    return "no_refund_after_window";
  }

  // Fallback to raw status
  return b.status as BookingStatusCode;
}

/** Convenience: directly compute the badge for a booking row in one call. */
export function bookingBadge(b: Parameters<typeof deriveBookingStatus>[0]): { tone: StateBadgeTone; label: string } {
  const derived = deriveBookingStatus(b);
  if ((DERIVED as any)[derived]) return DERIVED[derived as DerivedStatus];
  return bookingStatusBadge(derived);
}

function titleCase(s: string): string {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
