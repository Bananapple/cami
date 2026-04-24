import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://brie-alpha.vercel.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST",
      },
    });
  }

  try {
    // --- Auth: require a valid Supabase JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header" }, 401);
    }
    const jwt = authHeader.slice(7);

    // User-scoped client for reading (respects RLS)
    const userClient = createClient(SUPABASE_URL, jwt);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Service-role client for writing (bypasses RLS — used only for inserts we control)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse request body ---
    const { class_instance_id, return_url } = await req.json();
    if (!class_instance_id) return json({ error: "class_instance_id is required" }, 400);

    // --- Fetch class instance: price and studio_id (server-side — never trust client) ---
    const { data: instance, error: instanceErr } = await adminClient
      .from("class_instances")
      .select("id, studio_id, price, status, starts_at, template_id")
      .eq("id", class_instance_id)
      .eq("status", "scheduled")
      .single();
    if (instanceErr || !instance) return json({ error: "Class not found or not schedulable" }, 404);

    // --- Verify user is a member of this studio ---
    const { data: member } = await adminClient
      .from("studio_members")
      .select("id, is_active")
      .eq("studio_id", instance.studio_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!member) return json({ error: "You are not a member of this studio" }, 403);

    // --- Resolve studio's primary payment provider ---
    const { data: providerRow, error: providerErr } = await adminClient
      .from("studio_payment_providers")
      .select("provider, provider_account_id")
      .eq("studio_id", instance.studio_id)
      .eq("is_primary", true)
      .eq("is_active", true)
      .not("onboarded_at", "is", null)
      .maybeSingle();
    if (providerErr || !providerRow) {
      return json({ error: "This studio is not configured for online payment" }, 402);
    }

    const adapter = getProvider(providerRow.provider as any);

    // --- Insert payments row (status: requires_action) ---
    const { data: payment, error: paymentErr } = await adminClient
      .from("payments")
      .insert({
        studio_id: instance.studio_id,
        user_id: user.id,
        provider: providerRow.provider,
        status: "requires_action",
        amount: instance.price,
        currency: "NOK",
      })
      .select("id")
      .single();
    if (paymentErr || !payment) return json({ error: "Failed to create payment record" }, 500);

    // --- Insert booking row (status: pending) ---
    const { data: booking, error: bookingErr } = await adminClient
      .from("bookings")
      .insert({
        studio_id: instance.studio_id,
        class_instance_id: instance.id,
        user_id: user.id,
        payment_id: payment.id,
        status: "pending",
      })
      .select("id")
      .single();
    if (bookingErr || !booking) {
      // Clean up the payment row before returning
      await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return json({ error: "Failed to create booking record" }, 500);
    }

    // --- Call provider adapter to create hosted checkout session ---
    const successUrl = `${return_url ?? APP_URL}?payment_id=${payment.id}&booking_id=${booking.id}&status=success`;
    const cancelUrl = `${return_url ?? APP_URL}?payment_id=${payment.id}&status=cancelled`;

    let checkoutResult;
    try {
      checkoutResult = await adapter.createCheckoutSession({
        studio_provider_account_id: providerRow.provider_account_id,
        amount: Math.round(instance.price * 100),  // convert NOK → øre
        currency: "NOK",
        description: `Class booking`,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          payment_id: payment.id,
          booking_id: booking.id,
          studio_id: instance.studio_id,
          user_id: user.id,
        },
      });
    } catch (err) {
      // Provider call failed — mark both rows as failed
      await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
      await adminClient.from("bookings").update({ status: "payment_failed" }).eq("id", booking.id);
      return json({ error: `Payment provider error: ${err}` }, 502);
    }

    // --- Update payments row with provider IDs and checkout URL ---
    await adminClient
      .from("payments")
      .update({
        provider_session_id: checkoutResult.provider_session_id,
        checkout_url: checkoutResult.checkout_url,
        return_url: return_url ?? APP_URL,
      })
      .eq("id", payment.id);

    return json({
      checkout_url: checkoutResult.checkout_url,
      payment_id: payment.id,
      booking_id: booking.id,
    });
  } catch (err) {
    console.error("create-checkout error:", err);
    return json({ error: "Internal server error" }, 500);
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
