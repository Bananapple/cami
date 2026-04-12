import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export interface SignUpPlan {
  name: string;
  price: string;
  desc: string;
}

interface SignUpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: SignUpPlan;
}

const DEFAULT_PLAN: SignUpPlan = {
  name: "Yoga Principles",
  price: "Free",
  desc: "Explore different styles of yoga & meditation with foundational tutorial videos.",
};

const SignUpSheet = ({ isOpen, onClose, plan = DEFAULT_PLAN }: SignUpSheetProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setEmail("");
      setName("");
    }, 300);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      toast("Please fill in all fields.");
      return;
    }
    setStep(3);
    toast("Account created successfully!");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l border-border bg-background overflow-y-auto">
        <SheetTitle className="sr-only">Sign Up</SheetTitle>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          {step > 1 && step < 3 ? (
            <button
              onClick={() => setStep((s) => (s > 1 ? (s - 1) as 1 | 2 : s))}
              className="p-1 hover:opacity-70 transition-opacity"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {step === 1 && "Your Order"}
            {step === 2 && "Create Account"}
            {step === 3 && "Confirmed"}
          </p>
          <div className="w-7" />
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-0.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Order Summary */}
        {step === 1 && (
          <div className="px-6 py-8 space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Selected Plan
              </p>
              <h2 className="text-2xl font-serif text-foreground">{plan.name}</h2>
            </div>

            <div className="bg-card rounded-lg p-6 space-y-4">
              <p className="text-sm text-muted-foreground font-serif leading-relaxed">
                {plan.desc}
              </p>
              <div className="flex items-baseline justify-between pt-4 border-t border-border">
                <span className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Total
                </span>
                <span className="text-2xl font-serif text-foreground">{plan.price}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-serif">Immediate access to all content</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-serif">Cancel anytime, no commitment</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-serif">Access on any device</span>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Create Account */}
        {step === 2 && (
          <form onSubmit={handleCreateAccount} className="px-6 py-8 space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Almost there
              </p>
              <h2 className="text-2xl font-serif text-foreground">Create your account</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 flex items-baseline justify-between">
              <span className="text-sm font-serif text-muted-foreground">{plan.name}</span>
              <span className="text-lg font-serif text-foreground">{plan.price}</span>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200"
            >
              Create Account
            </button>

            <p className="text-xs text-center text-muted-foreground font-serif">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center space-y-8 min-h-[60vh]">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-serif text-foreground">Thank you, {name || "friend"}!</h2>
              <p className="text-muted-foreground font-serif leading-relaxed max-w-xs mx-auto">
                Your <strong>{plan.name}</strong> plan is ready. Start exploring classes and begin your wellness journey today.
              </p>
            </div>

            <div className="space-y-3 w-full">
              <Link
                to="/classes"
                onClick={handleClose}
                className="block w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 text-center"
              >
                Browse Programs
              </Link>
              <button
                onClick={handleClose}
                className="w-full border border-border text-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg hover:bg-card transition-all duration-200"
              >
                Back Home
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default SignUpSheet;
