import { useState, useMemo } from "react";
import { Drawer, DrawerSection } from "../components/Drawer";
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
import { bookingBadge } from "../lib/bookingStatus";

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

  const ytdStats = useMemo(() => computeYtdStats(bookings), [bookings]);
  const recentActivity = useMemo(
    () => bookings.filter((b) => b.status === "confirmed").slice(0, 4),
    [bookings]
  );

  if (!userId) return null;

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

      {member && tab === "overview" && (
        <>
          <DrawerSection title="Stats · This year">
            <StatGrid>
              <Stat label="Booked" value={ytdStats.booked} />
              <Stat label="Attended" value={ytdStats.attended} />
              <Stat label="No-shows" value={ytdStats.noShows} tone={ytdStats.noShows > 0 ? "warn" : "default"} />
              <Stat label="Spend" value={`${currency} ${fmt(ytdStats.spend)}`} />
            </StatGrid>
          </DrawerSection>

          <DrawerSection title="Member insights">
            <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13, fontStyle: "italic" }}>
              Coming soon — booking frequency timeline and most-booked class.
            </p>
          </DrawerSection>

          <DrawerSection title="Recent activity">
            {recentActivity.length === 0 ? (
              <EmptyState title="No bookings yet" hint="Once they book a class, it'll show up here." />
            ) : (
              <ActivityList bookings={recentActivity} tz={studioTz} />
            )}
          </DrawerSection>

          <DrawerSection title="Member information">
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
            <KV label="Source" value="—" hint="Source attribution coming soon" />
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

      {member && tab === "activity" && (
        <DrawerSection title={`Activity · ${bookings.length}`} flush>
          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" hint="Once they book a class, it'll show up here." />
          ) : (
            <ActivityList bookings={bookings} tz={studioTz} />
          )}
        </DrawerSection>
      )}

      {member && tab === "billing" && (
        <DrawerSection title="Billing">
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

// ── Activity list (shared by Overview "Recent activity" + Activity tab) ──
// Title: class name + level chip
// Meta: "Sun 4 May · 11:30"
// Trail: status badge (Booked/Attended/No-show/Refunded/etc.)
function ActivityList({ bookings, tz }: { bookings: MemberBooking[]; tz: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {bookings.map((b) => {
        const localTz = b.location_timezone ?? tz;
        const isCancelled = b.status === "cancelled";
        const dateStr = formatDate(b.starts_at, localTz, { weekday: "short", day: "numeric", month: "short" });
        const timeStr = formatTime(b.starts_at, localTz);
        return (
          <Row
            key={b.id}
            title={
              <>
                <span style={isCancelled ? { color: "var(--ink-muted)", textDecoration: "line-through" } : undefined}>
                  {b.class_name}
                </span>
                {b.class_level && <CategoryChip>{b.class_level}</CategoryChip>}
              </>
            }
            meta={`${dateStr} · ${timeStr}`}
            trail={<BookingStatusBadge b={b} />}
            static
          />
        );
      })}
    </div>
  );
}

// ── Year-to-date stats ─────────────────────────────────────────────
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

    if ((b.payment_status === "succeeded" || b.payment_status === "partially_refunded") && b.payment_amount) {
      spend += b.payment_amount - (b.payment_refunded ?? 0);
    }
  }

  return { booked, attended, noShows, spend };
}

// ── BookingStatusBadge ─────────────────────────────────────────────
// Thin wrapper over the central bookingBadge helper (lib/bookingStatus).
function BookingStatusBadge({ b }: { b: MemberBooking }) {
  const cfg = bookingBadge(b);
  return <StateBadge tone={cfg.tone}>{cfg.label}</StateBadge>;
}

// ── KV (label / value pair, optional hint) ─────────────────────────
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
