import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 270-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.8 192.5-49.8 31 0 108.2 2.6 168.2 75.1zm-208.6-87.9c29.4-36.9 50.3-88.3 50.3-139.6 0-7.1-.6-14.3-1.9-20.1-47.7 1.9-104.6 31.8-139.1 74.5-26.6 30.5-51.9 81.9-51.9 134.1 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 43.4 0 97.8-29.4 127.1-68.3z"/>
    </svg>
  );
}

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
  const { sendOtp, verifyOtp, isAuthenticated, signInWithProvider } = useAuth();

  // Fires when OAuth popup completes and session lands in localStorage
  const didCallSuccess = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !didCallSuccess.current) {
      didCallSuccess.current = true;
      onSuccess();
    }
  }, [isAuthenticated, onSuccess]);

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
    <div className="space-y-6">
      <h3 className="text-lg font-serif text-foreground">Welcome</h3>

      {/* Social sign-in */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signInWithProvider("google")}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-lg border font-sans text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ background: "#fff", borderColor: "#dadce0", color: "#3c4043" }}
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => signInWithProvider("apple")}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-lg font-sans text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "#000", color: "#fff" }}
        >
          <AppleIcon />
          Continue with Apple
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-sans text-muted-foreground">or continue with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSendOtp} className="space-y-6">

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
    </div>
  );
};

export default AuthForm;
