import { useEffect, useRef, useState } from "react";
import { GlassFilter } from "@/components/ui/liquid-glass-button";
import AuthForm from "@/components/booking/AuthForm";

type Phase = "idle" | "text1" | "text2" | "cta" | "nav" | "notifications";
const PHASES: Phase[] = ["idle", "text1", "text2", "cta", "nav", "notifications"];
const gte = (cur: Phase, target: Phase) => PHASES.indexOf(cur) >= PHASES.indexOf(target);

// Lighter, heavier-blur liquid glass
const liquidGlass: React.CSSProperties = {
  background: "rgba(60, 57, 54, 0.42)",
  backdropFilter: 'url("#container-glass") blur(64px) saturate(200%)',
  WebkitBackdropFilter: 'url("#container-glass") blur(64px) saturate(200%)',
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.16)",
  boxShadow: [
    "0 4px 24px rgba(0,0,0,0.18)",
    "inset 1px 1px 1px -0.5px rgba(255,255,255,0.55)",
    "inset -1px -1px 1px -0.5px rgba(255,255,255,0.25)",
    "inset 0 0 8px 4px rgba(255,255,255,0.07)",
  ].join(", "),
  width: "min(360px, calc(100vw - 32px))",
};

// iOS app icon style — square with rounded corners + soft shine border
const appIcon = (bg: string): React.CSSProperties => ({
  width: 46, height: 46, borderRadius: 11, flexShrink: 0,
  background: bg,
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: [
    "inset 0 1px 0 rgba(255,255,255,0.50)",
    "inset 0 -1px 0 rgba(0,0,0,0.18)",
    "inset 1px 0 0 rgba(255,255,255,0.22)",
    "inset -1px 0 0 rgba(0,0,0,0.10)",
    "0 2px 8px rgba(0,0,0,0.28)",
    "0 0 0 0.5px rgba(255,255,255,0.18)",
  ].join(", "),
});

// ─── Notification cards ───────────────────────────────────────────────────────

function EmailCard() {
  return (
    <div style={liquidGlass} className="px-4 py-3.5 flex items-start gap-3">
      {/* iOS Mail icon */}
      <div style={appIcon("linear-gradient(155deg, #74c2f5 0%, #1e8cf0 45%, #0e5fd8 100%)")}>
        <svg width="27" height="21" viewBox="0 0 27 21" fill="none">
          <rect x="0.5" y="0.5" width="26" height="20" rx="2.5" fill="white" fillOpacity="0.95"/>
          <path d="M1 3l12.5 9L26 3" stroke="#4da8f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="0.5" y="0.5" width="26" height="20" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" fill="none"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Mail</span>
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>now</span>
        </div>
        <div className="text-[15px] font-semibold text-white leading-snug mt-0.5">Would you mind leaving us a review?</div>
        <div className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>To: Emma · Tiny Haven</div>
      </div>
    </div>
  );
}

function TrafficCard() {
  const sources = [
    { name: "TikTok",    color: "#ffffff", pct: 62 },
    { name: "Instagram", color: "#E1306C", pct: 48 },
    { name: "Facebook",  color: "#4B9CF5", pct: 35 },
    { name: "Google",    color: "#7DC8A4", pct: 78 },
  ];
  return (
    <div style={liquidGlass} className="px-4 py-3.5 flex items-start gap-3">
      <div style={appIcon("linear-gradient(145deg, hsl(42,85%,60%), hsl(28,75%,42%))")}>
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
          <path d="M2 14l4.5-6 4 3.5L16 4l4 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Cami · Traffic</span>
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>this week</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {sources.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="text-[11.5px] w-[64px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.55)" }}>{s.name}</span>
              <div className="flex-1 h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color, opacity: 0.85 }} />
              </div>
              <span className="text-[10.5px] w-6 text-right tabular-nums" style={{ color: "rgba(255,255,255,0.38)" }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AudienceCard() {
  const segments = [
    { label: "Lapsing regulars",        count: 12, dot: "#f87171" },
    { label: "First-timers this month", count: 8,  dot: "#7DC8A4" },
    { label: "High-LTV referrers",      count: 5,  dot: "hsl(42 58% 60%)" },
  ];
  return (
    <div style={liquidGlass} className="px-4 py-3.5 flex items-start gap-3">
      <div style={appIcon("linear-gradient(145deg, hsl(155,45%,52%), hsl(42,70%,48%))")}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
          <path d="M10 0L11.8 6.5H18.5L13 10.5L15 17L10 13L5 17L7 10.5L1.5 6.5H8.2L10 0Z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Smart Audiences</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: "hsl(42 58% 46% / 0.32)", color: "hsl(42 58% 78%)" }}>AI</span>
        </div>
        <div className="space-y-1.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.78)" }}>{s.label}</span>
              </div>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CARDS = [EmailCard, TrafficCard, AudienceCard];

// ─── Notification sequence ───────────────────────────────────────────────────
// Flow: A shown → A exits up while B advances from behind → B is in place → repeat
// No persistent back card; next card only mounts during the transition window.

function NotificationSequence() {
  const [front, setFront] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const hold = 3800;
    const exitDur = 720;
    const t1 = setTimeout(() => setExiting(true), hold);
    const t2 = setTimeout(() => { setExiting(false); setFront((f) => f + 1); }, hold + exitDur);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [front]);

  const FrontCard = CARDS[front % CARDS.length];
  const NextCard  = CARDS[(front + 1) % CARDS.length];

  return (
    <div className="relative" style={{ width: "min(360px, calc(100vw - 32px))", height: 115 }}>

      {/* Next card — only in DOM during transition, advances from back position */}
      {exiting && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 1,
            animation: "ios-notify-advance 0.72s cubic-bezier(0.25,0.1,0.25,1) forwards",
          }}
        >
          <NextCard />
        </div>
      )}

      {/* Current card — exits up; when promoted (front > 0, not exiting) just sits there */}
      <div
        key={front}
        style={{
          position: "absolute", inset: 0, zIndex: 2,
          animation: exiting
            ? "ios-notify-out 0.72s cubic-bezier(0.4,0,1,1) forwards"
            : front === 0
              ? "ios-notify-in 0.75s cubic-bezier(0.34,1.1,0.64,1) forwards"
              : "none",
        }}
      >
        <FrontCard />
      </div>
    </div>
  );
}

// ─── Login drawer ─────────────────────────────────────────────────────────────

function LoginDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const manageUrl = (import.meta.env.VITE_MANAGE_URL as string) || "/manage";

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px]"
        style={{ maxHeight: "92vh", overflowY: "auto" }}
      >
        <div className="bg-background rounded-t-2xl md:rounded-2xl p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors text-lg"
            aria-label="Close"
          >
            ✕
          </button>
          <AuthForm onSuccess={() => { window.location.href = manageUrl; }} />
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CamiHome() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    // Video starts immediately on load
    videoRef.current?.play().catch(() => {});

    const timers = [
      setTimeout(() => setPhase("text1"),         1000),
      setTimeout(() => setPhase("text2"),         2600),
      setTimeout(() => setPhase("cta"),           4200),
      setTimeout(() => setPhase("nav"),           5100),
      setTimeout(() => setPhase("notifications"), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const showText1        = gte(phase, "text1");
  const showText2        = gte(phase, "text2");
  const showCta          = gte(phase, "cta");
  const showNav          = gte(phase, "nav");
  const showNotifs       = gte(phase, "notifications");

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ background: "#e4ddd4" }}>
      {/* GlassFilter SVG — referenced by notification backdropFilter */}
      <GlassFilter />

      {/* ── Video — auto-starts on load ── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover object-[30%_center] md:object-center"
        src="/hero-cami.mp4"
        playsInline
        muted
        preload="auto"
      />

      {/* ── "Cami" — visible from load, slides to top-left when Studio AI appears ── */}
      <div
        className="absolute z-30 pointer-events-none"
        style={{
          top: showText1 ? "1.4rem" : "1.75rem",
          left: showText1 ? "2rem" : "50%",
          transform: showText1 ? "translateX(0)" : "translateX(-50%)",
          transition: "left 0.6s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1), top 0.4s ease",
        }}
      >
        <span
          className="font-serif text-[1.4rem] text-white"
          style={{ letterSpacing: "-0.01em", textShadow: "0 1px 12px rgba(0,0,0,0.2)" }}
        >
          Cami
        </span>
      </div>

      {/* ── Log in button ── */}
      <div
        className="absolute top-0 right-0 z-30 px-8 py-6"
        style={{ opacity: showText1 ? 1 : 0, transition: "opacity 0.5s ease", transitionDelay: showText1 ? "200ms" : "0ms" }}
      >
        <button
          onClick={() => setLoginOpen(true)}
          className="text-sm font-medium px-4 py-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)", color: "white" }}
        >
          Log in
        </button>
      </div>

      {/* ── Hero headline — mobile: two independently positioned blocks ── */}

      {/* Mobile: "Studio AI" at shoulder level */}
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
          }}
        >
          Studio AI
        </h1>
      </div>

      {/* Mobile: "that has your back" + CTA at chest level */}
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
          }}
        >
          that has your back
        </p>
        <div
          className="mt-7"
          style={{
            animation: showCta ? "blur-fade-in 0.8s ease forwards" : "none",
            opacity: showCta ? undefined : 0,
          }}
        >
          <button className="text-sm font-medium px-6 py-3 rounded-full" style={{ background: "white", color: "#1a1611" }}>
            Book a demo
          </button>
        </div>
      </div>

      {/* Desktop: right half, vertically centered */}
      <div
        className="absolute inset-y-0 left-[50%] right-0 z-20 hidden md:flex flex-col justify-center items-center pr-16 pl-4"
      >
        <div className="text-right w-full" style={{ maxWidth: 480 }}>
          <h1 className="font-serif leading-[1.12]" style={{ fontSize: "clamp(2.4rem, 3.8vw, 3.6rem)" }}>
            <span
              className="block text-white"
              style={{
                animation: showText1 ? "blur-fade-in 1.1s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
                opacity: showText1 ? undefined : 0,
              }}
            >
              Studio AI
            </span>
            <span
              className="block text-white/85"
              style={{
                animation: showText2 ? "blur-fade-in 1.1s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
                opacity: showText2 ? undefined : 0,
              }}
            >
              that has your back
            </span>
          </h1>
          <div
            className="mt-7"
            style={{
              animation: showCta ? "blur-fade-in 0.8s ease forwards" : "none",
              opacity: showCta ? undefined : 0,
            }}
          >
            <button className="text-sm font-medium px-6 py-3 rounded-full" style={{ background: "white", color: "#1a1611" }}>
              Book a demo
            </button>
          </div>
        </div>
      </div>

      {/* ── Notifications — bottom-center on mobile, right half at 74% on desktop ── */}
      {showNotifs && (
        <div className="absolute z-20 flex justify-center left-0 right-0 bottom-6 md:bottom-auto md:top-[74%] md:left-[50%] md:right-0">
          <NotificationSequence />
        </div>
      )}

      <LoginDrawer open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* ── Social pill — desktop only ── */}
      <div
        className="absolute z-20 hidden md:flex items-center gap-3.5 px-5 py-3"
        style={{
          bottom: 12, right: 12,
          background: "url('/social-pill-bg.png') center/cover no-repeat",
          borderRadius: 20,
          boxShadow: "0 2px 16px rgba(0,0,0,0.14)",
        }}
      >
        {/* Info icon */}
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <circle cx="13" cy="13" r="11" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
          <circle cx="13" cy="8.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
          <rect x="11.5" y="11.5" width="3" height="7.5" rx="1.5" fill="rgba(255,255,255,0.55)"/>
        </svg>
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.25)" }} />
        {/* Instagram */}
        <a href="#" aria-label="Instagram">
          <img src="/logo-instagram.png" width="28" height="28" style={{ borderRadius: 7 }} alt="Instagram" />
        </a>
        {/* Facebook */}
        <a href="#" aria-label="Facebook">
          <img src="/logo-facebook.png" width="28" height="28" style={{ borderRadius: 7 }} alt="Facebook" />
        </a>
        {/* LinkedIn */}
        <a href="#" aria-label="LinkedIn">
          <img src="/logo-linkedin.png" width="28" height="28" style={{ borderRadius: 7 }} alt="LinkedIn" />
        </a>
      </div>
    </div>
  );
}
