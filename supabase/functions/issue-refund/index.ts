import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-studio-slug",
        "Access-Control-Allow-Methods": "POST",
      },
    });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const jwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse body ---
    const { booking_id } = await req.json();
    if (!booking_id) return json({ error: "booking_id is required" }, 400);

    // --- Fetch booking with class_instance starts_at and studio cancellation window ---
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select(`
        id, studio_id, user_id, payment_id, membership_id, status,
        class_instances ( starts_at ),
        studios ( cancellation_window_hours )
      `)
      .eq("id", booking_id)
      .single();
    if (bookingErr || !booking) return json({ error: "Booking not found" }, 404);

    // --- Authorization: user owns booking OR is staff ---
    const isOwner = booking.user_id === user.id;
    if (!isOwner) {
      const { data: member } = await admin
        .from("studio_members")
        .select("role")
        .eq("studio_id", booking.studio_id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("role", ["owner", "manager"])
        .maybeSingle();
      if (!member) return json({ error: "Forbidden" }, 403);
    }

    // --- Guard: already cancelled ---
    if (booking.status === "cancelled") {
      return json({ error: "Booking is already cancelled" }, 409);
    }

    // --- Determine refund eligibility ---
    const startsAt = new Date((booking.class_instances as any).starts_at);
    const windowHours = (booking.studios as any)?.cancellation_window_hours ?? 24;
    const outsideWindow = (startsAt.getTime() - Date.now()) > windowHours * 60 * 60 * 1000;
    const hasPayment = !!booking.payment_id;
    const hasMembership = !!booking.membership_id;

    // --- Always cancel the booking first ---
    await admin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking_id);

    // --- Credit-paid booking: return credit if within refund window ---
    if (hasMembership) {
      if (outsideWindow) {
        await admin.rpc("return_credit", { p_membership_id: booking.membership_id });
        return json({ cancelled: true, credit_returned: true });
      }
      return json({ cancelled: true, credit_returned: false, reason: "inside_cancellation_window" });
    }

    if (!hasPayment || !outsideWindow) {
      // Mark the payment cancelled so the dashboard doesn't show "refund pending"
      if (hasPayment) {
        await admin.from("payments").update({ status: "cancelled" }).eq("id", booking.payment_id);
      }
      return json({
        cancelled: true,
        refunded: false,
        reason: !hasPayment ? "no_payment" : "inside_cancellation_window",
      });
    }

    // --- Fetch payment for refund ---
    const { data: payment } = await admin
      .from("payments")
      .select("id, provider, provider_payment_id, status, amount, refunded_amount")
      .eq("id", booking.payment_id)
      .single();

    if (!payment || payment.status !== "succeeded" || !payment.provider_payment_id) {
      return json({
        cancelled: true,
        refunded: false,
        reason: "payment_not_refundable",
      });
    }

    // --- Attempt refund; on failure still return cancelled=true ---
    try {
      const adapter = getProvider(payment.provider as any);
      const refundAmount = payment.amount - (payment.refunded_amount ?? 0);
      const result = await adapter.issueRefund({
        provider_payment_id: payment.provider_payment_id,
        amount: Math.round(refundAmount * 100),  // NOK → øre
        reason: "requested_by_customer",
      });

      const newRefundedTotal = (payment.refunded_amount ?? 0) + refundAmount;
      const newStatus = newRefundedTotal >= payment.amount ? "refunded" : "partially_refunded";

      await admin.from("payments").update({
        refunded_amount: newRefundedTotal,
        provider_refund_id: result.provider_refund_id,
        refund_reason: "requested_by_customer",
        status: newStatus,
      }).eq("id", payment.id);

      return json({ cancelled: true, refunded: true, refund_amount: refundAmount });
    } catch (err) {
      console.error("Refund failed after cancellation:", err);
      return json({
        cancelled: true,
        refunded: false,
        reason: "refund_failed",
        note: String(err),
      });
    }
  } catch (err) {
    console.error("issue-refund error:", err);
    return json({ error: `Internal server error: ${err}` }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
