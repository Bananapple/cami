import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://brie-alpha.vercel.app";

// Allowed origins for return_url to prevent open redirect attacks.
const ALLOWED_ORIGINS = [APP_URL].map((u) => new URL(u).origin);

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
    // --- Auth: require a valid Supabase JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header" }, 401);
    }
    const jwt = authHeader.slice(7);

    // User-scoped client: anon key as API key, user JWT as auth header
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Service-role client for writing (bypasses RLS — used only for inserts we control)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse request body ---
    // Accepts either { class_instance_id } (book a class) or { product_id } (buy a membership/clip card)
    const { class_instance_id, product_id, return_url, discount_code } = await req.json();
    if (!class_instance_id && !product_id) {
      return json({ error: "Either class_instance_id or product_id is required" }, 400);
    }
    if (class_instance_id && product_id) {
      return json({ error: "Cannot specify both class_instance_id and product_id" }, 400);
    }

    // --- Validate return_url to prevent open redirect ---
    if (return_url) {
      let parsed: URL;
      try {
        parsed = new URL(return_url);
      } catch {
        return json({ error: "Invalid return_url" }, 400);
      }
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (!ALLOWED_ORIGINS.includes(parsed.origin) && !isLocalhost) {
        return json({ error: "Invalid return_url" }, 400);
      }
    }

    // --- Resolve target: class booking OR product purchase ---
    let studioId: string;
    let amountMinor: number;     // smallest currency unit (øre, cents)
    let currency: string;
    let description: string;
    let extraMetadata: Record<string, string> = {};
    let resolvedClassInstance: { id: string; studio_id: string; max_capacity: number; price: number } | null = null;
    let resolvedProductId: string | null = null;
    let recurring: { interval: "month"; interval_count: number } | undefined;

    if (class_instance_id) {
      // --- Class booking path ---
      const { data: instance, error: instanceErr } = await adminClient
        .from("class_instances")
        .select("id, studio_id, price, status, max_capacity, class_templates ( name )")
        .eq("id", class_instance_id)
        .eq("status", "scheduled")
        .single();
      if (instanceErr || !instance) return json({ error: "Class not found or not schedulable" }, 404);
      const className = (instance as any).class_templates?.name ?? "Class";

      // Capacity check: count pending + confirmed bookings (UNIQUE constraint is the hard stop)
      const { count: bookingCount } = await adminClient
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("class_instance_id", class_instance_id)
        .in("status", ["pending", "confirmed"]);
      if (instance.max_capacity > 0 && (bookingCount ?? 0) >= instance.max_capacity) {
        return json({ error: "This class is fully booked" }, 409);
      }

      const { data: studio } = await adminClient
        .from("studios")
        .select("currency")
        .eq("id", instance.studio_id)
        .single();

      studioId = instance.studio_id;
      currency = (studio as any)?.currency ?? "NOK";
      amountMinor = Math.round(instance.price * 100);
      description = className;
      resolvedClassInstance = { id: instance.id, studio_id: instance.studio_id, max_capacity: instance.max_capacity, price: instance.price };

      // --- Check for active membership: subscription (unlimited) or clip card with credits ---
      // Fetch all active memberships for this user+studio, validate in application code
      // to avoid brittle PostgREST OR filter chaining.
      const today = new Date().toISOString().split("T")[0];
      const { data: memberships } = await adminClient
        .from("memberships")
        .select("id, credits_remaining, valid_until")
        .eq("user_id", user.id)
        .eq("studio_id", studioId)
        .eq("status", "active")
        // Subscriptions (NULL credits = unlimited) before clip cards.
        // Reason: clip cards are stored value, subscriptions are active plans —
        // burn the active plan, preserve stored value.
        // Within same type, expire-soonest first so urgent credits get used first.
        .order("credits_remaining", { ascending: true, nullsFirst: true })
        .order("valid_until", { ascending: true, nullsFirst: false });

      const activeMembership = (memberships ?? []).find((m) => {
        const notExpired = !m.valid_until || m.valid_until >= today;
        const hasAccess = m.credits_remaining === null || m.credits_remaining > 0;
        return notExpired && hasAccess;
      }) ?? null;

      if (activeMembership) {
        await adminClient.from("studio_members").upsert(
          { studio_id: studioId, user_id: user.id, role: "member", is_active: true },
          { onConflict: "studio_id,user_id", ignoreDuplicates: true }
        );
        const { data: bookingId, error: creditErr } = await adminClient.rpc("book_with_credit", {
          p_user_id: user.id,
          p_class_instance_id: class_instance_id,
          p_membership_id: activeMembership.id,
        });
        if (creditErr) {
          const message = creditErr.code === "23505"
            ? "You already have a booking for this class."
            : creditErr.message ?? "Booking failed";
          return json({ error: message }, 409);
        }
        return json({ booking_id: bookingId, free: true });
      }
    } else {
      // --- Product purchase path ---
      const { data: product, error: productErr } = await adminClient
        .from("products")
        .select("id, studio_id, name, type, price_minor, currency, requires_contact, is_active, billing_interval")
        .eq("id", product_id)
        .single();
      if (productErr || !product) return json({ error: "Product not found" }, 404);
      if (!product.is_active) return json({ error: "Product is not available" }, 400);
      if (product.requires_contact) {
        return json({ error: "This product requires a personal consultation — please contact the studio" }, 400);
      }
      if (product.type === "drop_in") {
        return json({ error: "Drop-in classes must be booked from the schedule" }, 400);
      }

      studioId = product.studio_id;
      currency = product.currency;
      amountMinor = product.price_minor;
      description = product.name;
      resolvedProductId = product.id;
      extraMetadata = { product_id: product.id, product_type: product.type };

      // Recurring subscription: pass interval so the adapter switches to subscription mode
      if (product.billing_interval === "month") {
        recurring = { interval: "month", interval_count: 1 };
      }
    }

    // --- Validate and apply discount code ---
    // Two paths: (1) staff-created promo code in discount_codes, (2) peer referral code
    // from studio_members.referral_code. Promo codes apply to anything; referral codes
    // apply to first-time drop-in bookings only and are governed by the studio's
    // referral program settings.
    let discountMinor = 0;
    let resolvedDiscountCodeId: string | null = null;

    if (discount_code) {
      const normalizedCode = discount_code.trim().toUpperCase();

      // --- Path 1: promo code ---
      const { data: promoCode } = await adminClient
        .from("discount_codes")
        .select("id, discount_type, discount_value, valid_from, valid_until, max_redemptions, times_redeemed")
        .eq("studio_id", studioId)
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (promoCode) {
        const now = new Date();
        const withinWindow =
          (!promoCode.valid_from || now >= new Date(promoCode.valid_from)) &&
          (!promoCode.valid_until || now <= new Date(promoCode.valid_until));
        const withinLimit = promoCode.max_redemptions === null || promoCode.times_redeemed < promoCode.max_redemptions;
        const { count: alreadyUsed } = await adminClient
          .from("discount_redemptions")
          .select("*", { count: "exact", head: true })
          .eq("code_id", promoCode.id)
          .eq("redeemed_by_user_id", user.id);

        if (withinWindow && withinLimit && (alreadyUsed ?? 0) === 0) {
          if (promoCode.discount_type === "percent") {
            discountMinor = Math.round(amountMinor * Number(promoCode.discount_value) / 100);
          } else {
            discountMinor = Math.round(Number(promoCode.discount_value) * 100);
          }
          discountMinor = Math.min(discountMinor, amountMinor);
          resolvedDiscountCodeId = promoCode.id;
        }
      }

      // --- Path 2: referral code (class bookings only, first-time customers only) ---
      if (!resolvedDiscountCodeId && resolvedClassInstance) {
        const { data: referrerMember } = await adminClient
          .from("studio_members")
          .select("user_id")
          .eq("studio_id", studioId)
          .eq("referral_code", normalizedCode)
          .maybeSingle();

        if (referrerMember && referrerMember.user_id !== user.id) {
          const { data: studioSettings } = await adminClient
            .from("studios")
            .select("referral_enabled, referral_discount_percent")
            .eq("id", studioId)
            .single();

          if (studioSettings?.referral_enabled && studioSettings.referral_discount_percent > 0) {
            // First-time check: no prior confirmed bookings at this studio
            const { count: priorBookings } = await adminClient
              .from("bookings")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("studio_id", studioId)
              .eq("status", "confirmed");

            // One referral per user per studio
            const { count: priorReferrals } = await adminClient
              .from("referrals")
              .select("*", { count: "exact", head: true })
              .eq("referred_user_id", user.id)
              .eq("studio_id", studioId);

            if ((priorBookings ?? 0) === 0 && (priorReferrals ?? 0) === 0) {
              discountMinor = Math.round(amountMinor * studioSettings.referral_discount_percent / 100);
              discountMinor = Math.min(discountMinor, amountMinor);

              await adminClient.from("referrals").insert({
                studio_id: studioId,
                referrer_user_id: referrerMember.user_id,
                referred_user_id: user.id,
                referral_code: normalizedCode,
                status: "pending",
                discount_applied_percent: studioSettings.referral_discount_percent,
              });
            }
          }
        }
      }

      amountMinor -= discountMinor;
    }

    // --- Auto-enroll user as a member of this studio ---
    await adminClient.from("studio_members").upsert(
      { studio_id: studioId, user_id: user.id, role: "member", is_active: true },
      { onConflict: "studio_id,user_id", ignoreDuplicates: true }
    );

    // --- Fetch customer name for provider pre-fill (best-effort) ---
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const customerName = profile?.full_name || undefined;

    // --- Resolve studio's primary payment provider ---
    const { data: providerRow, error: providerErr } = await adminClient
      .from("studio_payment_providers")
      .select("provider, provider_account_id")
      .eq("studio_id", studioId)
      .eq("is_primary", true)
      .eq("is_active", true)
      .not("onboarded_at", "is", null)
      .maybeSingle();
    if (providerErr || !providerRow) {
      return json({ error: "This studio is not configured for online payment" }, 402);
    }

    const adapter = getProvider(providerRow.provider as any);

    // --- Insert payments row ---
    const { data: payment, error: paymentErr } = await adminClient
      .from("payments")
      .insert({
        studio_id: studioId,
        user_id: user.id,
        provider: providerRow.provider,
        status: "requires_action",
        amount: amountMinor / 100,
        currency,
        product_id: resolvedProductId,
        discount_code: discount_code ?? null,
      })
      .select("id")
      .single();
    if (paymentErr || !payment) return json({ error: "Failed to create payment record" }, 500);

    // --- Record discount redemption (trigger auto-increments times_redeemed) ---
    if (resolvedDiscountCodeId && discountMinor > 0) {
      await adminClient.from("discount_redemptions").insert({
        code_id: resolvedDiscountCodeId,
        redeemed_by_user_id: user.id,
        payment_id: payment.id,
        discount_applied_minor: discountMinor,
      });
    }

    // --- Class booking only: insert pending booking row ---
    let bookingId: string | null = null;
    if (resolvedClassInstance) {
      const { data: booking, error: bookingErr } = await adminClient
        .from("bookings")
        .insert({
          studio_id: resolvedClassInstance.studio_id,
          class_instance_id: resolvedClassInstance.id,
          user_id: user.id,
          payment_id: payment.id,
          status: "pending",
        })
        .select("id")
        .single();
      if (bookingErr || !booking) {
        if ((bookingErr as any)?.code === "23505") {
          // Conflict — check if it's a stale pending booking (abandoned checkout) or a real confirmed one
          const { data: existing } = await adminClient
            .from("bookings")
            .select("id, status")
            .eq("user_id", user.id)
            .eq("class_instance_id", resolvedClassInstance.id)
            .single();
          if (existing?.status === "pending") {
            // Reuse the stale booking with the new payment — do NOT mark payment as failed
            const { data: replaced, error: replaceErr } = await adminClient
              .from("bookings")
              .update({ payment_id: payment.id, booked_at: new Date().toISOString() })
              .eq("id", existing.id)
              .select("id")
              .single();
            if (!replaceErr && replaced) {
              bookingId = replaced.id;
            } else {
              await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
              return json({ error: "Failed to create booking record" }, 500);
            }
          } else {
            await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
            return json({ error: "You already have a booking for this class." }, 409);
          }
        } else {
          await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
          return json({ error: "Failed to create booking record" }, 500);
        }
      } else {
        bookingId = booking.id;
      }
    }

    // --- Call provider adapter to create hosted checkout session ---
    const base = return_url ?? APP_URL;
    const successQs = bookingId
      ? `payment_id=${payment.id}&booking_id=${bookingId}&status=success`
      : `payment_id=${payment.id}&status=success`;
    const successUrl = `${base}?${successQs}`;
    const cancelUrl = `${base}?payment_id=${payment.id}&status=cancelled`;

    let checkoutResult;
    try {
      checkoutResult = await adapter.createCheckoutSession({
        studio_provider_account_id: providerRow.provider_account_id,
        customer_email: user.email,
        customer_name: customerName,
        amount: amountMinor,
        currency,
        description,
        success_url: successUrl,
        cancel_url: cancelUrl,
        recurring,
        metadata: {
          payment_id: payment.id,
          studio_id: studioId,
          user_id: user.id,
          ...(bookingId ? { booking_id: bookingId } : {}),
          ...extraMetadata,
        },
      });
    } catch (err) {
      await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
      if (bookingId) {
        await adminClient.from("bookings").update({ status: "payment_failed" }).eq("id", bookingId);
      }
      return json({ error: `Payment provider error: ${err}` }, 502);
    }

    // --- Update payments row with provider IDs and checkout URL ---
    await adminClient
      .from("payments")
      .update({
        provider_session_id: checkoutResult.provider_session_id,
        checkout_url: checkoutResult.checkout_url,
        return_url: base,
      })
      .eq("id", payment.id);

    return json({
      checkout_url: checkoutResult.checkout_url,
      payment_id: payment.id,
      booking_id: bookingId,
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
