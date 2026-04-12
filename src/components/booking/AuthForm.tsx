import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AuthFormProps {
  onSuccess: () => void;
}

const AuthForm = ({ onSuccess }: AuthFormProps) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn({ email, password });
      } else {
        if (!fullName) {
          toast("Please enter your name.");
          setLoading(false);
          return;
        }
        await signUp({ email, password, fullName });
      }
      toast(mode === "login" ? "Welcome back!" : "Account created!");
      onSuccess();
    } catch (err: any) {
      toast(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-serif text-foreground">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h3>

      <div className="space-y-5">
        {mode === "signup" && (
          <div className="space-y-2">
            <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className={inputClass}
            />
          </div>
        )}

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
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
            required
          />
          {mode === "login" && (
            <p className="text-xs text-primary font-sans cursor-pointer hover:underline text-right mt-1">
              Forgot password?
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
      </button>

      <p className="text-xs text-center text-muted-foreground font-serif">
        {mode === "login" ? (
          <>
            New here?{" "}
            <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
              Create an account
            </button>
          </>
        ) : (
          <>
            Already a member?{" "}
            <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
              Log in
            </button>
          </>
        )}
      </p>
    </form>
  );
};

export default AuthForm;
