import type { StateBadgeTone } from "../components/Badge";
import type { MemberSummary } from "@/manage/hooks/useClientsView";

export type PlanHealth =
  | { tone: StateBadgeTone; label: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * DATA-2: derive plan *health* (not plan name).
 * The trailing badge on a Clients row uses this.
 */
export function getPlanHealth(m: Pick<MemberSummary, "membership_id" | "credits_remaining" | "valid_until">): PlanHealth {
  if (!m.membership_id) {
    return { tone: "neutral", label: "No plan" };
  }

  // Clip card with credits — flag low credits
  if (m.credits_remaining !== null && m.credits_remaining !== undefined) {
    if (m.credits_remaining <= 0) return { tone: "bad", label: "Out of credits" };
    if (m.credits_remaining <= 3) return { tone: "warn", label: "Low credits" };
  }

  // Expiry / lapsed
  if (m.valid_until) {
    const validUntil = new Date(m.valid_until).getTime();
    const now = Date.now();
    if (validUntil < now) return { tone: "bad", label: "Lapsed" };
    if (validUntil - now < 14 * DAY_MS) return { tone: "info", label: "Expiring" };
  }

  return { tone: "good", label: "Active" };
}
