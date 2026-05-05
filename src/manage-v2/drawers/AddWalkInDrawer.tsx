import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, inputStyle } from "../components/Field";
import { EmptyState } from "../components/EmptyState";
import { useClientsView, type MemberSummary } from "@/manage/hooks/useClientsView";
import { useStudioContext } from "@/context/StudioContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Add walk-in: staff records someone who showed up at the studio for a class.
// Picks an existing member, then either uses a credit (if active membership)
// or creates a no-payment booking (studio collects cash/card at the door).
// Booking is auto-checked-in since the person is physically present.

export function AddWalkInDrawer({
  classInstanceId,
  className,
  open,
  onClose,
}: {
  classInstanceId: string | null;
  className: string;
  open: boolean;
  onClose: () => void;
}) {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();
  const { members, isLoading } = useClientsView();
  const [search, setSearch] = useState("");
  const [pickedUserId, setPickedUserId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [members, search]);

  const picked = pickedUserId ? members.find((m) => m.user_id === pickedUserId) ?? null : null;
  const hasCredits = !!picked && !!picked.membership_id && (picked.credits_remaining === null || (picked.credits_remaining ?? 0) > 0);

  const reset = () => {
    setSearch("");
    setPickedUserId(null);
    setPending(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!classInstanceId || !picked || !studioId) return;
    setPending(true);
    try {
      let bookingId: string | null = null;

      if (hasCredits && picked.membership_id) {
        // Use credit — book_with_credit RPC handles the atomic credit decrement
        const { data, error } = await supabase.rpc("book_with_credit" as any, {
          p_user_id: picked.user_id,
          p_class_instance_id: classInstanceId,
          p_membership_id: picked.membership_id,
        });
        if (error) throw error;
        bookingId = (data as any)?.booking_id ?? (data as any)?.id ?? null;
      } else {
        // No payment, no membership — studio collects cash/card at door
        const { data, error } = await supabase
          .from("bookings")
          .insert({
            studio_id: studioId,
            class_instance_id: classInstanceId,
            user_id: picked.user_id,
            status: "confirmed",
            checked_in_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) {
          if (error.code === "23505") throw new Error("This member already has a booking for this class.");
          throw error;
        }
        bookingId = data?.id ?? null;
      }

      // For credit bookings, mark them checked-in too (book_with_credit doesn't do that)
      if (bookingId && hasCredits) {
        await supabase.from("bookings").update({ checked_in_at: new Date().toISOString() }).eq("id", bookingId);
      }

      toast.success(
        hasCredits
          ? `${picked.full_name} added — 1 credit used`
          : `${picked.full_name} added as walk-in`
      );
      qc.invalidateQueries({ queryKey: ["manage", "class_attendance", classInstanceId] });
      qc.invalidateQueries({ queryKey: ["manage", "schedule"] });
      qc.invalidateQueries({ queryKey: ["manage", "today"] });
      handleClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add walk-in");
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Add walk-in"
      subtitle={className}
      actions={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={pending} disabled={!picked}>
            {hasCredits ? "Use credit & check in" : "Add as walk-in"}
          </Button>
        </>
      }
    >
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Member" help="Search by name or email">
          <input
            type="text"
            value={search}
            placeholder="Type to search…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPickedUserId(null);
            }}
            style={inputStyle}
            autoFocus
          />
        </Field>

        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--r-card)",
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          {isLoading && <p style={rowMutedStyle}>Loading members…</p>}
          {!isLoading && matches.length === 0 && (
            <EmptyState title="No matches" hint="Try a different name or email." />
          )}
          {!isLoading && matches.map((m) => (
            <MemberRow
              key={m.user_id}
              m={m}
              selected={pickedUserId === m.user_id}
              onPick={() => setPickedUserId(m.user_id)}
            />
          ))}
        </div>

        {picked && (
          <div
            style={{
              padding: "10px 12px",
              fontSize: 13,
              color: "var(--ink-soft)",
              background: "var(--surface-2)",
              borderRadius: "var(--r-input)",
              border: "1px solid var(--line-soft)",
            }}
          >
            {hasCredits ? (
              <>
                <strong style={{ color: "var(--ink)" }}>{picked.plan_name ?? "Active membership"}</strong>
                {" — "}
                {picked.credits_remaining === null
                  ? "unlimited credits"
                  : `${picked.credits_remaining} credit${picked.credits_remaining === 1 ? "" : "s"} remaining`}
                . 1 credit will be used and the member will be checked in.
              </>
            ) : (
              <>
                No active membership — booking is created without payment. <strong style={{ color: "var(--ink)" }}>Collect at the door.</strong>
              </>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function MemberRow({
  m,
  selected,
  onPick,
}: {
  m: MemberSummary;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: "1px solid var(--line-soft)",
        background: selected ? "var(--surface-2)" : "transparent",
        width: "100%",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--ink-soft)",
          fontWeight: 500,
        }}
      >
        {initialsFor(m.full_name)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.full_name}</div>
        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 1 }}>{m.email ?? "—"}</div>
      </div>
      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
        {m.membership_id
          ? m.credits_remaining === null
            ? "Membership"
            : `${m.credits_remaining} credit${m.credits_remaining === 1 ? "" : "s"}`
          : "No plan"}
      </span>
    </button>
  );
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

const rowMutedStyle: React.CSSProperties = {
  margin: 0,
  padding: "16px",
  fontSize: 13,
  color: "var(--ink-muted)",
  textAlign: "center",
};
