import { Check, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Session = Tables<"sessions">;

interface ConfirmationViewProps {
  session: Session;
  selectedDate: Date;
  email: string;
  onClose: () => void;
}

const ConfirmationView = ({ session, selectedDate, email, onClose }: ConfirmationViewProps) => {
  const dateStr = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-6 py-12 flex flex-col items-center justify-center text-center space-y-8 min-h-[60vh]">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Check className="w-8 h-8 text-primary" />
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-serif text-foreground">You're all set!</h2>
        <div className="space-y-1">
          <p className="text-foreground font-serif">{session.class_name} with {session.practitioner_name}</p>
          <p className="text-muted-foreground text-sm font-sans">{dateStr} · {session.time}</p>
          <p className="text-muted-foreground text-sm font-sans">{session.location}</p>
        </div>
        <p className="text-xs text-muted-foreground font-sans mt-4">
          Confirmation sent to {email}
        </p>
      </div>

      <div className="space-y-3 w-full">
        <Link
          to="/dashboard"
          onClick={onClose}
          className="block w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 text-center"
        >
          View My Sessions
        </Link>
        <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-sans">
          <Calendar className="w-4 h-4" />
          Add to Calendar
        </button>
      </div>
    </div>
  );
};

export default ConfirmationView;
