import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AuthFormProps {
  onSuccess: () => void;
}

const RESEND_COOLDOWN = 30;

const AuthForm = ({ onSuccess }: AuthFormProps) => {
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const { sendOtp, verifyOtp } = useAuth();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      await sendOtp({ email });
      setPhase("code");
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err: any) {
      setError(err.message ?? "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (overrideToken?: string) => {
    const code = overrideToken ?? token;
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp({ email, token: code });
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? "Invalid code. Please try again.");
      setToken("");
      codeRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setToken(val);
    if (val.length === 6) handleVerify(val);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setToken("");
    try {
      await sendOtp({ email });
      setCooldown(RESEND_COOLDOWN);
      toast("New code sent.");
    } catch (err: any) {
      setError(err.message ?? "Failed to resend. Please try again.");
    }
  };

  const inputClass =
    "w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50";

  if (phase === "code") {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-serif text-foreground">Enter your code</h3>
          <p className="text-sm text-muted-foreground font-sans mt-1">
            We emailed a 6-digit code to <span className="text-foreground">{email}</span>
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Code
          </label>
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={token}
            onChange={handleCodeChange}
            placeholder="123456"
            className={`${inputClass} font-mono text-xl tracking-[0.5em]`}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive font-sans">{error}</p>
        )}

        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={loading || token.length !== 6}
          className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify →"}
        </button>

        <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
          <button
            type="button"
            onClick={() => { setPhase("email"); setToken(""); setError(null); }}
            className="hover:text-foreground transition-colors"
          >
            ← Different email
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="hover:text-foreground transition-colors disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-6">
      <h3 className="text-lg font-serif text-foreground">Welcome</h3>

      <div className="space-y-2">
        <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className={inputClass}
          required
          autoFocus
        />
      </div>

      {error && (
        <p className="text-sm text-destructive font-sans">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Continue →"}
      </button>

      <p className="text-xs text-center text-muted-foreground font-serif">
        We'll send a one-time code to your inbox.
      </p>
    </form>
  );
};

export default AuthForm;
