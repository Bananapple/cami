import { Clock, MapPin } from "lucide-react";
import type { ClassInstance } from "@/hooks/useClassInstances";

interface OrderSummaryProps {
  session: ClassInstance;
  selectedDate: Date;
}

const OrderSummary = ({ session, selectedDate }: OrderSummaryProps) => {
  const dateStr = selectedDate.toLocaleDateString("nb-NO", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-header rounded-xl p-6 space-y-5">
      <div>
        <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-foreground/60 mb-1">
          Your
        </p>
        <h3 className="text-2xl font-serif text-foreground">ORDER</h3>
      </div>

      <div className="bg-background/50 rounded-lg p-4 space-y-3">
        <p className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/60">
          (1) Drop In — 1 Class
        </p>
        <p className="text-xs font-sans text-foreground/60">{session.location}</p>
        <div className="flex items-center gap-1.5 text-xs text-foreground/60">
          <Clock className="w-3 h-3" />
          Valid for 1 month
        </div>
      </div>

      <div className="border-t border-border/50 pt-4 space-y-2">
        <p className="text-sm font-serif text-foreground font-medium">
          {session.class_name}
        </p>
        <p className="text-xs text-foreground/70 font-serif">
          with {session.practitioner_name}
        </p>
        <p className="text-xs text-foreground/70 font-sans">
          {dateStr} · {session.time}
        </p>
        <p className="text-xs text-foreground/70 font-sans flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {session.location}
        </p>
        <p className="text-xs text-foreground/70 font-sans">
          {session.duration} min · {session.level}
        </p>
      </div>

      <div className="border-t border-border/50 pt-4 flex items-baseline justify-between">
        <span className="text-xs font-sans font-medium uppercase tracking-wider text-foreground/60">
          Total
        </span>
        <span className="text-2xl font-serif text-foreground">
          kr {(session.price ?? 250).toLocaleString("nb-NO")}
        </span>
      </div>
    </div>
  );
};

export default OrderSummary;
