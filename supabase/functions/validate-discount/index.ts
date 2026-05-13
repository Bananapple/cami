import { createClient } from "jsr:@supabase/supabase-js@2";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(req, { error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { code, class_instance_id } = await req.json();
    if (!code || !class_instance_id) return json(req, { valid: false, label: "Code required" });

    const normalizedCode = (code as string).trim().toUpperCase();

    const { data: instance } = await admin
      .from("class_instances")
      .select("studio_id, price")
      .eq("id", class_instance_id)
      .single();
    if (!instance) return json(req, { valid: false, label: "Class not found" });

    const studioId = instance.studio_id;

    // --- Cross-tenant guard ---
    const guardErr = await validateStudioMatch(req, admin, studioId);
    if (guardErr) return guardErr;
    const originalMinor = Math.round(instance.price * 100);
    let discountMinor = 0;
    let label = "";
    let valid = false;

    // --- Path 1: promo code in discount_codes ---
    const { data: promo } = await admin
      .from("discount_codes")
      .select("id, discount_type, discount_value, valid_from, valid_until, max_redemptions, times_redeemed")
      .eq("studio_id", studioId)
      .eq("code", normalizedCode)
      .eq("is_active", true)
      .maybeSingle();

    let reason: string | undefined;

    if (promo) {
      const now = new Date();
      const withinWindow =
        (!promo.valid_from || now >= new Date(promo.valid_from)) &&
        (!promo.valid_until || now <= new Date(promo.valid_until));
      const withinLimit = promo.max_redemptions === null || promo.times_redeemed < promo.max_redemptions;

      const { count: used } = await admin
        .from("discount_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("code_id", promo.id)
        .eq("redeemed_by_user_id", user.id);

      if (withinWindow && withinLimit && (used ?? 0) === 0) {
        if (promo.discount_type === "percent") {
          discountMinor = Math.round(originalMinor * Number(promo.discount_value) / 100);
          label = `${promo.discount_value}% off`;
        } else {
          discountMinor = Math.round(Number(promo.discount_value) * 100);
          label = `kr ${promo.discount_value} off`;
        }
        discountMinor = Math.min(discountMinor, originalMinor);
        valid = true;
      } else if (!withinWindow) {
        reason = "expired";
      } else if (!withinLimit) {
        reason = "maxed";
      } else {
        reason = "already_used";
      }
    }

    // --- Path 2: referral code ---
    if (!valid) {
      const { data: referrer } = await admin
        .from("studio_members")
        .select("user_id")
        .eq("studio_id", studioId)
        .eq("referral_code", normalizedCode)
        .maybeSingle();

      if (referrer && referrer.user_id !== user.id) {
        const { data: studio } = await admin
          .from("studios")
          .select("referral_enabled, referral_discount_percent")
          .eq("id", studioId)
          .single();

        if (studio?.referral_enabled && studio.referral_discount_percent > 0) {
          const { count: priorBookings } = await admin
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("studio_id", studioId)
            .eq("status", "confirmed");

          const { count: priorReferrals } = await admin
            .from("referrals")
            .select("*", { count: "exact", head: true })
            .eq("referred_user_id", user.id)
            .eq("studio_id", studioId);

          if ((priorBookings ?? 0) === 0 && (priorReferrals ?? 0) === 0) {
            discountMinor = Math.round(originalMinor * studio.referral_discount_percent / 100);
            discountMinor = Math.min(discountMinor, originalMinor);
            label = `${studio.referral_discount_percent}% off`;
            valid = true;
          }
        }
      }
    }

    return json(req, {
      valid,
      label,
      reason: valid ? undefined : (reason ?? "not_found"),
      original_price_minor: originalMinor,
      discount_minor: discountMinor,
      discounted_price_minor: originalMinor - discountMinor,
    });
  } catch (err) {
    console.error("validate-discount error:", err);
    return json(req, { error: "Internal server error" }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
