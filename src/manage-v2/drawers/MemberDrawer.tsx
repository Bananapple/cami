import { useState, useMemo } from "react";
import { Drawer, DrawerSection, EditLink } from "../components/Drawer";
import { Button } from "../components/Button";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { Stat, StatGrid } from "../components/Stat";
import { Row } from "../components/Row";
import { EmptyState } from "../components/EmptyState";
import { useMember } from "@/manage/hooks/useMember";
import { useMemberBookings, type MemberBooking } from "@/manage/hooks/useMemberBookings";
import { useNotificationLog, templateLabel } from "@/manage/hooks/useNotificationLog";
import { useStudioContext } from "@/context/StudioContext";
import { formatDate, formatTime } from "@/lib/timezone";
import { getPlanHealth } from "../lib/planHealth";

type Tab = "overview" | "activity" | "billing" | "notes";

export function MemberDrawerV2({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";
  const currency = studioCtx?.studio?.currency ?? "NOK";
  const { data: member, isLoading } = useMember(userId ?? undefined);
  const { data: bookings = [] } = useMemberBookings(userId ?? undefined);
  const { data: notifications = [] } = useNotificationLog(userId ?? undefined);

  // Year-to-date stats
  const ytdStats = useMemo(() => computeYtdStats(bookings), [bookings]);

  // Recent activity — last 4 confirmed bookings (any time)
  const recentActivity = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "confirmed")
        .slice(0, 4),
    [bookings]
  );

  if (!userId) return null;

  // Plan health for the header badge
  const planHealth = member
    ? getPlanHealth({
        membership_id: member.membership?.id ?? null,
        credits_remaining: member.membership?.credits_remaining ?? null,
        valid_until: member.membership?.valid_until ?? null,
      })
    : { tone: "neutral" as const, label: "Loading…" };

  const initials = (member?.full_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isLoading ? "Loading…" : member?.full_name ?? "Member"}
      subtitle={member?.email ?? undefined}
      headerLead={<div className="sm-av-lg">{initials}</div>}
      headerMeta={
        member ? (
          <>
            <StateBadge tone={planHealth.tone}>{planHealth.label}</StateBadge>
            {member.membership && <CategoryChip>{member.membership.plan_name}</CategoryChip>}
            <Count value={ytdStats.attended} label="this year" />
          </>
        ) : undefined
      }
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "activity", label: "Activity", count: bookings.length },
        { id: "billing", label: "Billing" },
        { id: "notes", label: "Notes", count: notifications.length },
      ]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      actions={
        member && (
          <>
            <Button variant="danger" style={{ marginRight: "auto" }} onClick={() => alert("TODO: deactivate flow")}>
              Deactivate
            </Button>
            <Button variant="ghost" onClick={() => alert("TODO: send message")}>Send message</Button>
            <Button variant="primary" onClick={() => alert("TODO: edit member")}>Edit member</Button>
          </>
        )
      }
    >
      {!member && <p style={{ padding: "16px 20px", color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>}

      {/* ── Overview ── */}
      {member && tab === "overview" && (
        <>
          <DrawerSection title="Stats · This year" borderless>
            <StatGrid>
              <Stat label="Booked" value={ytdStats.booked} />
              <Stat label="Attended" value={ytdStats.attended} />
              <Stat label="No-shows" value={ytdStats.noShows} tone={ytdStats.noShows > 0 ? "warn" : "default"} />
              <Stat label="Spend" value={`${currency} ${fmt(ytdStats.spend)}`} />
            </StatGrid>
          </DrawerSection>

          {/* Member insights — placeholder, server-side computation pending */}
          <DrawerSection title="Member insights" borderless>
            <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13, fontStyle: "italic" }}>
              Coming soon — booking frequency timeline and most-booked class.
            </p>
          </DrawerSection>

          <DrawerSection title="Recent activity" borderless>
            {recentActivity.length === 0 ? (
              <EmptyState title="No bookings yet" hint="Once they book a class, it'll show up here." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {recentActivity.map((b) => {
                  const tz = b.location_timezone ?? studioTz;
                  return (
                    <Row
                      key={b.id}
                      lead={
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            color: "var(--ink-soft)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatDate(b.starts_at, tz, { day: "numeric", month: "short" })}
                        </span>
                      }
                      title={b.class_name}
                      meta={formatTime(b.starts_at, tz)}
                      trail={<BookingPaymentBadge b={b} />}
                      static
                    />
                  );
                })}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Member information" borderless action={<EditLink onClick={() => alert("TODO: edit member info")}>Edit</EditLink>}>
            <KV label="Email" value={member.email ?? "—"} />
            <KV label="Phone" value={member.phone_number ?? "—"} />
            <KV label="Level" value={member.level ?? "—"} />
            <KV label="Plan" value={member.membership?.plan_name ?? "No plan"} />
            <KV
              label="Joined"
              value={
                member.joined_at
                  ? formatDate(member.joined_at, studioTz, { day: "numeric", month: "short", year: "numeric" })
                  : "—"
              }
            />
            <KV
              label="Source"
              value="—"
              hint="Source attribution coming soon"
            />
            <KV
              label="Referral"
              value={
                member.referrals_sent > 0
                  ? `${member.referrals_sent} sent${member.referrals_converted > 0 ? ` · ${member.referrals_converted} converted` : ""}`
                  : "—"
              }
            />
          </DrawerSection>
        </>
      )}

      {/* ── Activity ── */}
      {member && tab === "activity" && (
        <DrawerSection title={`Activity · ${bookings.length}`} flush>
          {bookings.length === 0 && (
            <EmptyState title="No bookings yet" hint="Once they book a class, it'll show up here." />
          )}
          {bookings.map((b) => {
            const tz = b.location_timezone ?? studioTz;
            const isCancelled = b.status === "cancelled";
            return (
              <Row
                key={b.id}
                lead={
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: "var(--ink-soft)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDate(b.starts_at, tz, { day: "numeric", month: "short" })}
                  </span>
                }
                title={
                  <span style={isCancelled ? { color: "var(--ink-muted)", textDecoration: "line-through" } : undefined}>
                    {b.class_name}
                  </span>
                }
                meta={formatTime(b.starts_at, tz)}
                trail={<BookingPaymentBadge b={b} />}
                static
              />
            );
          })}
        </DrawerSection>
      )}

      {/* ── Billing ── */}
      {member && tab === "billing" && (
        <DrawerSection title="Billing" borderless>
          {!member.membership ? (
            <EmptyState title="No payment activity" hint="Subscriptions and payments will appear here." />
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
              {member.membership.plan_name}
              {member.membership.valid_until && (
                <>
                  {" · "}
                  next bill {formatDate(member.membership.valid_until, studioTz, { day: "numeric", month: "short" })}
                </>
              )}
            </p>
          )}
        </DrawerSection>
      )}

      {/* ── Notes (emails) ── */}
      {member && tab === "notes" && (
        <DrawerSection title={`Emails sent · ${notifications.length}`} flush>
          {notifications.length === 0 && <EmptyState title="No emails sent yet" />}
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 20px",
                borderBottom: "1px solid var(--line-soft)",
                fontSize: 13,
              }}
            >
              <span>{templateLabel(n.template)}</span>
              <span style={{ color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
                {formatDate(n.sent_at, studioTz, { day: "numeric", month: "short" })}{" "}
                {formatTime(n.sent_at, studioTz)}
              </span>
            </div>
          ))}
        </DrawerSection>
      )}
    </Drawer>
  );
}

// ── Year-to-date stats from member bookings ────────────────────────
function computeYtdStats(bookings: MemberBooking[]) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const now = Date.now();

  let booked = 0;
  let attended = 0;
  let noShows = 0;
  let spend = 0;

  for (const b of bookings) {
    const startsAt = b.starts_at ? new Date(b.starts_at).getTime() : 0;
    if (startsAt < yearStart) continue;

    if (b.status === "confirmed") {
      booked += 1;
      if (b.checked_in_at) {
        attended += 1;
      } else if (startsAt < now) {
        noShows += 1;
      }
    }

    // Spend: count any payment that ran (succeeded or refunded) — net of refund
    if (b.payment_status === "succeeded" && b.payment_amount) {
      spend += b.payment_amount - (b.payment_refunded ?? 0);
    } else if (b.payment_status === "partially_refunded" && b.payment_amount) {
      spend += b.payment_amount - (b.payment_refunded ?? 0);
    }
  }

  return { booked, attended, noShows, spend };
}

// ── Booking payment badge (shared logic with Activity tab) ─────────
function BookingPaymentBadge({ b }: { b: MemberBooking }) {
  const WINDOW_MS = 24 * 60 * 60 * 1000;

  if (b.status === "confirmed") {
    return b.membership_id ? (
      <StateBadge tone="neutral">Membership</StateBadge>
    ) : (
      <StateBadge tone="good">Paid</StateBadge>
    );
  }

  if (b.membership_id) {
    const within =
      b.cancelled_at &&
      b.starts_at &&
      new Date(b.starts_at).getTime() - new Date(b.cancelled_at).getTime() > WINDOW_MS;
    return <StateBadge tone="neutral">{within ? "Credit returned" : "No credit"}</StateBadge>;
  }

  if (!b.payment_id) return <StateBadge tone="neutral">No payment</StateBadge>;
  if (b.payment_status === "refunded") return <StateBadge tone="info">Refunded</StateBadge>;
  if (b.payment_status === "partially_refunded") return <StateBadge tone="warn">Partial refund</StateBadge>;

  const within =
    b.cancelled_at &&
    b.starts_at &&
    new Date(b.starts_at).getTime() - new Date(b.cancelled_at).getTime() > WINDOW_MS;
  if (within) return <StateBadge tone="bad">Refund failed</StateBadge>;
  return <StateBadge tone="neutral">No refund</StateBadge>;
}

// ── KV (label/value pair, supports a hint) ─────────────────────────
function KV({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ padding: "6px 0", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "var(--ink-muted)" }}>{label}</span>
        <span style={{ color: "var(--ink)", textAlign: "right" }}>{value}</span>
      </div>
      {hint && (
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2, textAlign: "right" }}>{hint}</div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
}
