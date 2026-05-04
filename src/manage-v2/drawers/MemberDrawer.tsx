import { useState } from "react";
import { Drawer, DrawerSection, EditLink } from "../components/Drawer";
import { Button } from "../components/Button";
import { StateBadge, CategoryChip, Count } from "../components/Badge";
import { Stat, StatGrid } from "../components/Stat";
import { Row } from "../components/Row";
import { OverflowMenu } from "../components/OverflowMenu";
import { EmptyState } from "../components/EmptyState";
import { useMember } from "@/manage/hooks/useMember";
import { useMemberBookings } from "@/manage/hooks/useMemberBookings";
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
  const { data: member, isLoading } = useMember(userId ?? undefined);
  const { data: bookings = [] } = useMemberBookings(userId ?? undefined);
  const { data: notifications = [] } = useNotificationLog(userId ?? undefined);

  if (!userId) return null;

  // Derived plan health for the header badge
  const planHealth = member
    ? getPlanHealth({
        membership_id: member.membership?.id ?? null,
        credits_remaining: member.membership?.credits_remaining ?? null,
        valid_until: member.membership?.valid_until ?? null,
      })
    : { tone: "neutral" as const, label: "Loading…" };

  // Visits this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const visitsThisMonth = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.starts_at) >= monthStart
  ).length;

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
            <Count value={visitsThisMonth} label="this month" />
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
          <DrawerSection title="Stats">
            <StatGrid>
              <Stat label="This month" value={visitsThisMonth} />
              <Stat label="Total visits" value={member.total_sessions} />
              <Stat label="No-shows" value={member.no_shows} tone={member.no_shows > 0 ? "warn" : "default"} />
              <Stat
                label="Since"
                value={
                  member.joined_at
                    ? new Date(member.joined_at).toLocaleDateString("nb-NO", { month: "short", year: "numeric" })
                    : "—"
                }
              />
            </StatGrid>
          </DrawerSection>

          <DrawerSection title="Plan" action={<EditLink onClick={() => alert("TODO: change plan")}>Change plan</EditLink>}>
            {member.membership ? (
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                <p style={{ margin: "0 0 4px", color: "var(--ink)", fontWeight: 500 }}>
                  {member.membership.plan_name}
                </p>
                {member.membership.credits_remaining !== null && (
                  <p style={{ margin: "0 0 4px" }}>
                    {member.membership.credits_remaining} credit{member.membership.credits_remaining === 1 ? "" : "s"} remaining
                  </p>
                )}
                {member.membership.valid_until && (
                  <p style={{ margin: 0, color: "var(--ink-muted)" }}>
                    Valid until {formatDate(member.membership.valid_until, studioTz, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>No active plan</p>
            )}
          </DrawerSection>

          {(member.referrals_sent ?? 0) > 0 && (
            <DrawerSection title="Referrals">
              <p style={{ margin: 0, fontSize: 13 }}>
                {member.referrals_sent} sent
                {member.referrals_converted > 0 && (
                  <span style={{ color: "var(--good)" }}> · {member.referrals_converted} converted</span>
                )}
              </p>
            </DrawerSection>
          )}

          <DrawerSection title="Contact" action={<EditLink onClick={() => alert("TODO: edit contact")}>Edit</EditLink>}>
            <KV label="Email" value={member.email ?? "—"} />
            <KV label="Phone" value={member.phone_number ?? "—"} />
            <KV label="Level" value={member.level ?? "—"} />
          </DrawerSection>
        </>
      )}

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
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                    {formatDate(b.starts_at, tz, { day: "numeric", month: "short" })}
                  </span>
                }
                title={
                  <span style={isCancelled ? { color: "var(--ink-muted)", textDecoration: "line-through" } : undefined}>
                    {b.class_name}
                  </span>
                }
                meta={`${formatTime(b.starts_at, tz)}`}
                trail={<BookingPaymentBadge b={b} />}
                onSelect={() => {}}
                static
              />
            );
          })}
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
          {notifications.length === 0 && (
            <EmptyState title="No emails sent yet" />
          )}
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
                {new Date(n.sent_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}{" "}
                {new Date(n.sent_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </DrawerSection>
      )}
    </Drawer>
  );
}

// ── Booking payment badge (matches the legacy MemberDrawer logic) ──
function BookingPaymentBadge({ b }: { b: ReturnType<typeof useMemberBookings>["data"][number] }) {
  const WINDOW_MS = 24 * 60 * 60 * 1000;

  if (b.status === "confirmed") {
    return b.membership_id
      ? <StateBadge tone="neutral">Membership</StateBadge>
      : <StateBadge tone="good">Paid</StateBadge>;
  }

  // Cancelled
  if (b.membership_id) {
    const within = b.cancelled_at && b.starts_at &&
      (new Date(b.starts_at).getTime() - new Date(b.cancelled_at).getTime()) > WINDOW_MS;
    return <StateBadge tone="neutral">{within ? "Credit returned" : "No credit"}</StateBadge>;
  }

  if (!b.payment_id) return <StateBadge tone="neutral">No payment</StateBadge>;
  if (b.payment_status === "refunded") return <StateBadge tone="info">Refunded</StateBadge>;
  if (b.payment_status === "partially_refunded") return <StateBadge tone="warn">Partial refund</StateBadge>;

  const within = b.cancelled_at && b.starts_at &&
    (new Date(b.starts_at).getTime() - new Date(b.cancelled_at).getTime()) > WINDOW_MS;
  if (within) return <StateBadge tone="bad">Refund failed</StateBadge>;
  return <StateBadge tone="neutral">No refund</StateBadge>;
}

// ── KV ─────────────────────────────────────────────────────────────
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  );
}
