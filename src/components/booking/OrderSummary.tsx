import { Clock, MapPin } from "lucide-react";
import type { ClassInstance } from "@/hooks/useClassInstances";
import { formatTime, formatDate } from "@/lib/timezone";
import { useStudioContext } from "@/context/StudioContext";

interface OrderSummaryProps {
  session: ClassInstance;
  selectedDate: Date;
  bookingMode: "subscription" | "credit" | "dropin";
  planName?: string | null;
  creditsRemaining?: number | null;
  discountMinor?: number;
  discountLabel?: string;
}

const OrderSummary = ({ session, selectedDate, bookingMode, planName, creditsRemaining, discountMinor, discountLabel }: OrderSummaryProps) => {
  const studioCtx = useStudioContext();
  const tz = session.location_timezone ?? studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const dateStr = formatDate(selectedDate.toISOString(), tz, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timeStr = formatTime(session.starts_at, tz);

  const durationMin = Math.round(
    (new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000
  );

  return (
    <div className="bg-header rounded-xl p-6 space-y-5">
      <div>
        <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-foreground/60 mb-1">
          Your
        </p>
        <h3 className="text-2xl font-serif text-foreground">ORDER</h3>
      </div>

      <div className="bg-background/50 rounded-lg p-4 space-y-3">
        {bookingMode === "subscription" && (
          <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/60">
            {planName ?? "Membership"} — Included
          </p>
        )}
        {bookingMode === "credit" && (
          <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/60">
            Clip Card — 1 Credit ({creditsRemaining} remaining)
          </p>
        )}
        {bookingMode === "dropin" && (
          <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/60">
            (1) Drop In — 1 Class
          </p>
        )}
        <p className="text-xs font-sans text-foreground/60">{session.location}</p>
        {bookingMode === "dropin" && (
          <div className="flex items-center gap-1.5 text-xs text-foreground/60">
            <Clock className="w-3 h-3" />
            Valid for 1 month
          </div>
        )}
      </div>

      <div className="border-t border-border/50 pt-4 space-y-2">
        <p className="text-sm font-serif text-foreground font-medium">
          {session.class_name}
        </p>
        <p className="text-xs text-foreground/70 font-serif">
          with {session.practitioner_name}
        </p>
        <p className="text-xs text-foreground/70 font-sans">
          {dateStr} · {timeStr}
        </p>
        <p className="text-xs text-foreground/70 font-sans flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {session.location}
        </p>
        <p className="text-xs text-foreground/70 font-sans">
          {durationMin} min · {session.level}
        </p>
      </div>

      <div className="border-t border-border/50 pt-4 space-y-1">
        {bookingMode === "dropin" && discountMinor && discountMinor > 0 && discountLabel && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-green-600">{discountLabel}</span>
            <span className="text-xs font-sans text-green-600">
              − kr {(discountMinor / 100).toLocaleString("nb-NO")}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/60">
            Total
          </span>
          {bookingMode === "dropin" && discountMinor && discountMinor > 0 ? (
            <div className="text-right">
              <span className="text-sm font-serif text-foreground/40 line-through mr-2">
                kr {(session.price ?? 250).toLocaleString("nb-NO")}
              </span>
              <span className="text-2xl font-serif text-foreground">
                kr {(((session.price ?? 250) * 100 - discountMinor) / 100).toLocaleString("nb-NO")}
              </span>
            </div>
          ) : (
            <span className="text-2xl font-serif text-foreground">
              {bookingMode === "dropin"
                ? `kr ${(session.price ?? 250).toLocaleString("nb-NO")}`
                : bookingMode === "credit"
                  ? "1 credit"
                  : "Included"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
