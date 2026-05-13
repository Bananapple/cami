// User-initiated membership cancellation.
//
// Flow:
//   1. Authenticate user via Bearer JWT
//   2. Load membership; verify caller owns it and it's still active + not already scheduled
//   3. Resolve provider account (e.g. Stripe Connect acct_xxx) from studio_payment_providers
//   4. Call adapter.cancelSubscriptionAtPeriodEnd — Stripe will continue billing
//      until current period end, then emit customer.subscription.deleted, which the
//      payment-webhook reconciles via cancel_membership_by_subscription()
//   5. Stamp memberships.cancel_scheduled_at via request_membership_cancellation RPC
//      so the UI can render "Cancellation scheduled — access until <valid_until>"
//
// Provider-side call MUST succeed before the DB stamp — otherwise the UI would
// show "scheduled" while the provider continues billing without a cancel intent.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validateStudioMatch } from "../_shared/guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);
    const jwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json(req, { error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse body ---
    const { membership_id } = await req.json();
    if (!membership_id) return json(req, { error: "membership_id is required" }, 400);

    // --- Fetch membership ---
    const { data: membership, error: mErr } = await admin
      .from("memberships")
      .select("id, user_id, studio_id, status, provider, provider_subscription_id, valid_until, cancel_scheduled_at")
      .eq("id", membership_id)
      .maybeSingle();
    if (mErr || !membership) return json(req, { error: "Membership not found" }, 404);

    // --- Cross-tenant guard ---
    const guardErr = await validateStudioMatch(req, admin, membership.studio_id);
    if (guardErr) return guardErr;

    if (membership.user_id !== user.id) return json(req, { error: "Forbidden" }, 403);
    if (membership.status !== "active") return json(req, { error: "Membership is not active" }, 409);
    if (membership.cancel_scheduled_at) {
      return json(req, { scheduled: true, ends_at: membership.valid_until, already: true });
    }
    if (!membership.provider_subscription_id) {
      // Clip cards / one-time products have no subscription to cancel —
      // they expire naturally at valid_until.
      return json(req, { error: "This membership cannot be cancelled (no recurring subscription)" }, 400);
    }

    // --- Resolve provider account (Stripe Connect acct_xxx, etc.) ---
    const { data: providerRow } = await admin
      .from("studio_payment_providers")
      .select("provider_account_id")
      .eq("studio_id", membership.studio_id)
      .eq("provider", membership.provider)
      .eq("is_active", true)
      .maybeSingle();

    // --- Cancel at provider ---
    const adapter = getProvider(membership.provider as any);
    let cancelResult;
    try {
      cancelResult = await adapter.cancelSubscriptionAtPeriodEnd({
        provider_subscription_id: membership.provider_subscription_id,
        provider_account_id: providerRow?.provider_account_id ?? null,
      });
    } catch (err) {
      console.error("Provider cancel failed:", err);
      return json(req, { error: "Could not cancel with payment provider", detail: String(err) }, 502);
    }

    // --- Snap valid_until to provider's actual period end + stamp cancel_scheduled_at ---
    // Renewal flow keeps its 3-day grace; cancellation snaps to the provider's truth
    // so the UI's "Access until <date>" matches what the provider shows.
    const validUntil = new Date(cancelResult.current_period_end * 1000).toISOString().slice(0, 10);

    const { error: rpcErr } = await admin.rpc("request_membership_cancellation", {
      p_membership_id: membership_id,
      p_valid_until: validUntil,
    });
    if (rpcErr) {
      // Provider already accepted the cancel; surface but don't fail loudly —
      // webhook (subscription.deleted) will eventually flip status='cancelled' anyway.
      console.error("request_membership_cancellation RPC failed:", rpcErr);
    }

    return json(req, { scheduled: true, ends_at: validUntil });
  } catch (err) {
    console.error("cancel-membership error:", err);
    return json(req, { error: "Internal server error" }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
