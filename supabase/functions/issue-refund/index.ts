import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // --- Auth: staff only ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const jwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, jwt);
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse body ---
    const { payment_id, amount, reason } = await req.json();
    if (!payment_id) return json({ error: "payment_id is required" }, 400);

    // --- Fetch payment row ---
    const { data: payment, error: paymentErr } = await admin
      .from("payments")
      .select("id, studio_id, provider, provider_payment_id, status, amount, refunded_amount")
      .eq("id", payment_id)
      .single();
    if (paymentErr || !payment) return json({ error: "Payment not found" }, 404);
    if (payment.status !== "succeeded") {
      return json({ error: `Cannot refund a payment with status: ${payment.status}` }, 409);
    }

    // --- Verify the requesting user is staff (owner or manager) in this studio ---
    const { data: member } = await admin
      .from("studio_members")
      .select("role")
      .eq("studio_id", payment.studio_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "manager"])
      .maybeSingle();
    if (!member) return json({ error: "Forbidden — staff role required" }, 403);

    // --- Validate refund amount ---
    const maxRefundable = payment.amount - (payment.refunded_amount ?? 0);
    const refundAmount = amount !== undefined ? amount : payment.amount;
    if (refundAmount > maxRefundable) {
      return json({ error: `Refund amount ${refundAmount} exceeds refundable amount ${maxRefundable}` }, 400);
    }

    // --- Call provider adapter ---
    if (!payment.provider_payment_id) {
      return json({ error: "No provider payment ID on record — cannot issue refund" }, 409);
    }

    const adapter = getProvider(payment.provider as any);
    const result = await adapter.issueRefund({
      provider_payment_id: payment.provider_payment_id,
      amount: Math.round(refundAmount * 100),  // NOK → øre
      reason,
    });

    // --- Update payment row ---
    const newRefundedTotal = (payment.refunded_amount ?? 0) + refundAmount;
    const newStatus = newRefundedTotal >= payment.amount ? "refunded" : "partially_refunded";

    await admin.from("payments").update({
      refunded_amount: newRefundedTotal,
      provider_refund_id: result.provider_refund_id,
      refund_reason: reason ?? null,
      status: newStatus,
    }).eq("id", payment_id);

    return json({ payment_id, refunded_amount: newRefundedTotal, status: newStatus });
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
