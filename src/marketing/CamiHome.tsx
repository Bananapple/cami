import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "text1" | "text2" | "cta" | "nav";
const PHASES: Phase[] = ["idle", "text1", "text2", "cta", "nav"];
const gte = (cur: Phase, target: Phase) => PHASES.indexOf(cur) >= PHASES.indexOf(target);

// ─── Demo request modal ──────────────────────────────────────────────────────

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [studio, setStudio] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  const reset = () => {
    setName(""); setStudio(""); setCity(""); setMessage("");
    setSubmitting(false); setSubmitted(false); setError(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-demo-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ name, studio, city, message }),
        }
      );
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.03)",
    fontSize: 15,
    fontFamily: "-apple-system, 'Inter', system-ui, sans-serif",
    color: "#1a1611",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "blur-fade-in 0.18s ease forwards",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: "#faf8f5",
          borderRadius: 20,
          width: "100%",
          maxWidth: 460,
          padding: "32px",
          position: "relative",
          animation: "demo-modal-in 0.22s cubic-bezier(0.34,1.1,0.64,1) forwards",
          fontFamily: "-apple-system, 'Inter', system-ui, sans-serif",
          boxShadow: "0 24px 64px rgba(0,0,0,0.24), 0 4px 16px rgba(0,0,0,0.10)",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute", top: 16, right: 16,
            width: 32, height: 32, borderRadius: "50%",
            border: "none", background: "rgba(0,0,0,0.07)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#888", fontSize: 18, lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: "#1a1611", fontFamily: "Fraunces, Georgia, serif" }}>
              Thanks, we'll be in touch.
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: "#888" }}>
              We'll reach out to {name} shortly.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: "#1a1611", fontFamily: "Fraunces, Georgia, serif", letterSpacing: "-0.02em" }}>
              Book a demo
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888" }}>
              We'll reach out within one business day.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Your name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Emma"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Studio name
                  </label>
                  <input
                    required
                    value={studio}
                    onChange={(e) => setStudio(e.target.value)}
                    placeholder="Tiny Haven"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Oslo"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us a bit about your studio…"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                />
              </div>

              {error && (
                <p style={{ margin: 0, fontSize: 13, color: "#e05050" }}>
                  Something went wrong — try again or email nico@heycami.studio directly.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 4,
                  padding: "12px 24px",
                  borderRadius: 50,
                  border: "none",
                  background: "#1a1611",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: "-apple-system, 'Inter', system-ui, sans-serif",
                  cursor: submitting ? "wait" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CamiHome() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("deploy-cami");
    return () => document.documentElement.classList.remove("deploy-cami");
  }, []);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});

    const timers = [
      setTimeout(() => setPhase("text1"), 1000),
      setTimeout(() => setPhase("text2"), 2600),
      setTimeout(() => setPhase("cta"),   4200),
      setTimeout(() => setPhase("nav"),   5100),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const showText1 = gte(phase, "text1");
  const showText2 = gte(phase, "text2");
  const showCta   = gte(phase, "cta");

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ background: "#e4ddd4", fontFamily: "Fraunces, Georgia, serif" }}>

      {/* ── Video ── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover object-[30%_center] md:object-center"
        src="/hero-cami.mp4"
        playsInline
        muted
        preload="auto"
      />

      {/* ── "Cami" — always top-left, no animation ── */}
      <div className="absolute z-30 pointer-events-none" style={{ top: "1.4rem", left: "2rem" }}>
        <span
          className="font-serif text-[1.4rem] text-white"
          style={{ letterSpacing: "-0.01em", textShadow: "0 1px 12px rgba(0,0,0,0.2)" }}
        >
          Cami
        </span>
      </div>

      {/* ── Mobile hero ── */}
      <div
        className="absolute md:hidden left-0 right-0 z-20 flex justify-center px-6"
        style={{ top: "18vh" }}
      >
        <h1
          className="font-serif text-white text-center leading-[1.12]"
          style={{
            fontSize: "clamp(2.6rem, 10vw, 3.6rem)",
            animation: showText1 ? "blur-fade-in 1.1s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
            opacity: showText1 ? undefined : 0,
            textShadow: "2px 4px 18px rgba(185,158,122,0.45), 0 1px 3px rgba(0,0,0,0.12)",
          }}
        >
          Boutique checkout
        </h1>
      </div>

      <div
        className="absolute md:hidden left-0 right-0 z-20 flex flex-col items-center px-6"
        style={{ top: "50vh" }}
      >
        <p
          className="font-serif text-center leading-[1.12]"
          style={{
            fontSize: "clamp(2.6rem, 10vw, 3.6rem)",
            color: "rgba(255,255,255,0.85)",
            animation: showText2 ? "blur-fade-in 1.1s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
            opacity: showText2 ? undefined : 0,
            textShadow: "2px 4px 18px rgba(185,158,122,0.45), 0 1px 3px rgba(0,0,0,0.12)",
          }}
        >
          for independent studios.
        </p>
        <div
          className="mt-7"
          style={{
            animation: showCta ? "blur-fade-in 0.8s ease forwards" : "none",
            opacity: showCta ? undefined : 0,
          }}
        >
          <button
            onClick={() => setDemoOpen(true)}
            className="text-sm font-medium px-6 py-3 rounded-full"
            style={{ background: "white", color: "#1a1611", boxShadow: "2px 4px 18px rgba(185,158,122,0.45), 0 1px 3px rgba(0,0,0,0.12)" }}
          >
            Book a demo
          </button>
        </div>
      </div>

      {/* ── Desktop hero ── */}
      <div className="absolute inset-y-0 left-0 right-0 z-20 hidden md:flex flex-col justify-center items-end pr-20">
        <div className="text-right">
          <h1 className="font-serif leading-[1.12]" style={{ fontSize: "clamp(2.4rem, 3.8vw, 3.6rem)" }}>
            <span
              className="block text-white"
              style={{
                animation: showText1 ? "blur-fade-in 1.1s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
                opacity: showText1 ? undefined : 0,
                textShadow: "2px 4px 18px rgba(185,158,122,0.45), 0 1px 3px rgba(0,0,0,0.12)",
              }}
            >
              Boutique checkout
            </span>
            <span
              className="block text-white/85"
              style={{
                animation: showText2 ? "blur-fade-in 1.1s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
                opacity: showText2 ? undefined : 0,
                textShadow: "2px 4px 18px rgba(185,158,122,0.45), 0 1px 3px rgba(0,0,0,0.12)",
              }}
            >
              for independent studios.
            </span>
          </h1>
          <div
            className="mt-7"
            style={{
              animation: showCta ? "blur-fade-in 0.8s ease forwards" : "none",
              opacity: showCta ? undefined : 0,
            }}
          >
            <button
              onClick={() => setDemoOpen(true)}
              className="text-sm font-medium px-6 py-3 rounded-full"
              style={{ background: "white", color: "#1a1611", boxShadow: "2px 4px 18px rgba(185,158,122,0.45), 0 1px 3px rgba(0,0,0,0.12)" }}
            >
              Book a demo
            </button>
          </div>
        </div>
      </div>

      {/* ── Decorative triangle — desktop only ── */}
      <div
        className="absolute z-10 hidden md:block pointer-events-none"
        style={{
          bottom: 0, right: 0,
          width: 320, height: 130,
          background: "#c8b89a",
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        }}
      />
      {/* ── Social icons on triangle — desktop only ── */}
      <div
        className="absolute z-20 hidden md:flex items-center gap-4"
        style={{ bottom: 20, right: 22 }}
      >
        <a href="#" aria-label="Instagram">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5"/>
            <circle cx="12" cy="12" r="5"/>
            <circle cx="17.5" cy="6.5" r="1.2" fill="white" stroke="none"/>
          </svg>
        </a>
        <a href="#" aria-label="Facebook">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
          </svg>
        </a>
        <a href="#" aria-label="LinkedIn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V9h4v2a6 6 0 0 1 2-2z"/>
            <rect x="2" y="9" width="4" height="12"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
        </a>
      </div>

      {/* ── Demo modal ── */}
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
