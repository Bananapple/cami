// Persona definitions for the test-account seed.
// 15 accounts spanning every lifecycle bucket, frequency tier, plan type,
// time affinity, source attribution, and risk flag in the audience model.
//
// See ./README.md for the rationale per persona.

export type TimeBucket = "morning" | "midday" | "evening";

export type Source = "direct" | "referral" | "instagram" | "google";

export type TemplateName =
  | "Pilates"
  | "Ashtanga Mysore"
  | "Yin Yoga"
  | "Mama & Baby Pilates"
  | "Ashtanga Full Led";

export type PlanSpec =
  | { type: "subscription"; productName: "Monthly Unlimited"; validUntilDaysFromNow: number; cancelled?: boolean }
  | { type: "clip_card"; productName: "10× Clip Card"; creditsRemaining: number; validUntilDaysFromNow: number }
  | null; // drop-in / no plan

export type HistorySpec = {
  // Total backfilled bookings. Split across the time range below.
  totalBookings: number;
  // How far back the oldest backfilled booking should be (days).
  oldestDaysAgo: number;
  // The most recent backfilled booking (days ago). Drives Lapsing/Inactive/One-timer math.
  newestDaysAgo: number;
  // For one-timers: forces exactly 1 historical booking regardless of totalBookings.
  oneTimer?: boolean;
};

export type DailySpec = {
  // Probability of attempting a booking on any given cron run (0-1).
  bookProbability: number;
  // Probability of cancelling one of their upcoming bookings (0-1).
  cancelProbability: number;
};

export type Persona = {
  id: string;
  fullName: string;
  email: string;
  source: Source;
  status?: "on_leave";
  preferredTemplate: TemplateName;
  preferredTime: TimeBucket;
  plan: PlanSpec;
  history: HistorySpec;
  daily: DailySpec;
};

export const PERSONAS: Persona[] = [
  // ── Devotees & regulars (the studio's core) ───────────────────────────
  {
    id: "ada",
    fullName: "Ada Devotee",
    email: "ada@cami.test",
    source: "instagram",
    preferredTemplate: "Ashtanga Mysore",
    preferredTime: "morning",
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: 60 },
    history: { totalBookings: 24, oldestDaysAgo: 60, newestDaysAgo: 1 },
    daily: { bookProbability: 0.75, cancelProbability: 0.02 },
  },
  {
    id: "beatrice",
    fullName: "Beatrice Hagen",
    email: "beatrice@cami.test",
    source: "direct",
    preferredTemplate: "Pilates",
    preferredTime: "morning",
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: 75 },
    history: { totalBookings: 18, oldestDaysAgo: 55, newestDaysAgo: 2 },
    daily: { bookProbability: 0.65, cancelProbability: 0.03 },
  },
  {
    id: "cara",
    fullName: "Cara Renew",
    email: "cara@cami.test",
    source: "referral",
    preferredTemplate: "Ashtanga Full Led",
    preferredTime: "evening",
    // Sub renews in 18 days → fires sub_renewing_soon (<30d threshold)
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: 18 },
    history: { totalBookings: 12, oldestDaysAgo: 45, newestDaysAgo: 3 },
    daily: { bookProbability: 0.5, cancelProbability: 0.04 },
  },

  // ── Casual regulars ──────────────────────────────────────────────────
  {
    id: "dia",
    fullName: "Dia Midday",
    email: "dia@cami.test",
    source: "google",
    preferredTemplate: "Yin Yoga",
    preferredTime: "midday",
    plan: { type: "clip_card", productName: "10× Clip Card", creditsRemaining: 6, validUntilDaysFromNow: 200 },
    history: { totalBookings: 7, oldestDaysAgo: 40, newestDaysAgo: 4 },
    daily: { bookProbability: 0.3, cancelProbability: 0.05 },
  },
  {
    id: "eli",
    fullName: "Eli Dropin",
    email: "eli@cami.test",
    source: "direct",
    preferredTemplate: "Pilates",
    preferredTime: "evening",
    plan: null, // pure drop-in, no membership
    history: { totalBookings: 5, oldestDaysAgo: 35, newestDaysAgo: 6 },
    daily: { bookProbability: 0.25, cancelProbability: 0.05 },
  },
  {
    id: "fae",
    fullName: "Fae Expiring",
    email: "fae@cami.test",
    source: "instagram",
    preferredTemplate: "Ashtanga Mysore",
    preferredTime: "morning",
    // Clip card with 4 credits left, expiring in 10d → fires credits_expiring_soon
    plan: { type: "clip_card", productName: "10× Clip Card", creditsRemaining: 4, validUntilDaysFromNow: 10 },
    history: { totalBookings: 6, oldestDaysAgo: 30, newestDaysAgo: 2 },
    daily: { bookProbability: 0.4, cancelProbability: 0.04 },
  },
  {
    id: "gio",
    fullName: "Gio LateEvening",
    email: "gio@cami.test",
    source: "direct",
    preferredTemplate: "Yin Yoga",
    preferredTime: "evening", // bookings scheduled at 21:30 to exercise the 21:00+ extension
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: 90 },
    history: { totalBookings: 8, oldestDaysAgo: 35, newestDaysAgo: 3 },
    daily: { bookProbability: 0.4, cancelProbability: 0.03 },
  },

  // ── Lapsing (45-90 day window, ≥3 historical sessions) ────────────────
  {
    id: "hana",
    fullName: "Hana Faded",
    email: "hana@cami.test",
    source: "instagram",
    preferredTemplate: "Ashtanga Mysore",
    preferredTime: "morning",
    // Was on subscription, cancelled it
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: -10, cancelled: true },
    history: { totalBookings: 14, oldestDaysAgo: 110, newestDaysAgo: 60 },
    daily: { bookProbability: 0, cancelProbability: 0 }, // silent, not booking new
  },
  {
    id: "iris",
    fullName: "Iris Quiet",
    email: "iris@cami.test",
    source: "direct",
    preferredTemplate: "Pilates",
    preferredTime: "midday",
    plan: null,
    history: { totalBookings: 5, oldestDaysAgo: 95, newestDaysAgo: 55 },
    daily: { bookProbability: 0, cancelProbability: 0 },
  },
  {
    id: "jun",
    fullName: "Jun BurntOut",
    email: "jun@cami.test",
    source: "referral",
    preferredTemplate: "Ashtanga Full Led",
    preferredTime: "evening",
    plan: { type: "clip_card", productName: "10× Clip Card", creditsRemaining: 0, validUntilDaysFromNow: -30 },
    history: { totalBookings: 10, oldestDaysAgo: 100, newestDaysAgo: 50 },
    daily: { bookProbability: 0, cancelProbability: 0 },
  },

  // ── Inactive (>90 days since last booking) ────────────────────────────
  {
    id: "kit",
    fullName: "Kit LongGone",
    email: "kit@cami.test",
    source: "google",
    preferredTemplate: "Pilates",
    preferredTime: "morning",
    plan: null,
    history: { totalBookings: 8, oldestDaysAgo: 150, newestDaysAgo: 115 },
    daily: { bookProbability: 0, cancelProbability: 0 },
  },

  // ── One-timer (1 session, >14 days ago) ───────────────────────────────
  {
    id: "lila",
    fullName: "Lila OneShot",
    email: "lila@cami.test",
    source: "instagram",
    preferredTemplate: "Yin Yoga",
    preferredTime: "midday",
    plan: null,
    history: { totalBookings: 1, oldestDaysAgo: 25, newestDaysAgo: 25, oneTimer: true },
    daily: { bookProbability: 0, cancelProbability: 0 },
  },

  // ── New (joined within 30 days) ───────────────────────────────────────
  {
    id: "maya",
    fullName: "Maya FreshFace",
    email: "maya@cami.test",
    source: "direct",
    preferredTemplate: "Pilates",
    preferredTime: "morning",
    plan: null, // no plan yet
    history: { totalBookings: 0, oldestDaysAgo: 0, newestDaysAgo: 0 }, // joined recently, 0 bookings
    daily: { bookProbability: 0.15, cancelProbability: 0.05 }, // dipping toes
  },
  {
    id: "nia",
    fullName: "Nia HotStart",
    email: "nia@cami.test",
    source: "referral",
    preferredTemplate: "Ashtanga Mysore",
    preferredTime: "evening",
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: 22 },
    // Joined 8 days ago, already racked up bookings → New + Devotee
    history: { totalBookings: 6, oldestDaysAgo: 8, newestDaysAgo: 1 },
    daily: { bookProbability: 0.7, cancelProbability: 0.02 },
  },

  // ── On leave (status flag) ────────────────────────────────────────────
  {
    id: "ozzy",
    fullName: "Ozzy Paused",
    email: "ozzy@cami.test",
    source: "direct",
    status: "on_leave",
    preferredTemplate: "Pilates",
    preferredTime: "morning",
    plan: { type: "subscription", productName: "Monthly Unlimited", validUntilDaysFromNow: 45 },
    history: { totalBookings: 6, oldestDaysAgo: 70, newestDaysAgo: 35 },
    daily: { bookProbability: 0, cancelProbability: 0 }, // paused
  },
];

// Computed joined_at days-ago for each persona.
// New personas (Maya, Nia) joined within 30 days; everyone else 60-180 days ago.
export function joinedDaysAgo(p: Persona): number {
  if (p.id === "maya") return 5;
  if (p.id === "nia") return 8;
  if (p.history.totalBookings === 0) return 5;
  // Joined some days before their oldest booking, capped at 180.
  return Math.min(180, p.history.oldestDaysAgo + 10);
}
