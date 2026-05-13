import { createClient } from "jsr:@supabase/supabase-js@2";
import { getProvider } from "../_shared/providers/index.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { esc, buildConfirmationEmail } from "../_shared/email.ts";
import { validateStudioMatch } from "../_shared/guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

// Allowed origins for return_url to prevent open redirect attacks.
// APP_URL may be a comma-separated list to support multiple studios on
// separate Vercel deployments (e.g. brie-hd7s.vercel.app, cami-foo.vercel.app).
// The first entry is also used as the default return_url base when the caller
// doesn't supply one.
const ALLOWED_ORIGINS: string[] = APP_URL
  ? APP_URL.split(",").map((u) => {
      try { return new URL(u.trim()).origin; } catch { return ""; }
    }).filter(Boolean)
  : [];
const DEFAULT_APP_ORIGIN: string | undefined = ALLOWED_ORIGINS[0];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // --- Auth: require a valid Supabase JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(req, { error: "Missing authorization header" }, 401);
    }
    const jwt = authHeader.slice(7);

    // User-scoped client: anon key as API key, user JWT as auth header
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(req, { error: "Unauthorized" }, 401);

    // Service-role client for writing (bypasses RLS — used only for inserts we control)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse request body ---
    // Accepts either { class_instance_id } (book a class) or { product_id } (buy a membership/clip card)
    const { class_instance_id, product_id, return_url, discount_code } = await req.json();
    if (!class_instance_id && !product_id) {
      return json(req, { error: "Either class_instance_id or product_id is required" }, 400);
    }
    if (class_instance_id && product_id) {
      return json(req, { error: "Cannot specify both class_instance_id and product_id" }, 400);
    }

    // --- Validate return_url to prevent open redirect ---
    if (return_url) {
      let parsed: URL;
      try {
        parsed = new URL(return_url);
      } catch {
        return json(req, { error: "Invalid return_url" }, 400);
      }
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (!ALLOWED_ORIGINS.includes(parsed.origin) && !isLocalhost) {
        return json(req, { error: "Invalid return_url" }, 400);
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
    // Per-studio canonical URL (from studios.app_url). Used as the redirect
    // base when the caller doesn't pass return_url. Falls back to env-var
    // default when null. The validation allowlist still comes from the env var.
    let studioAppUrl: string | null = null;

    if (class_instance_id) {
      // --- Class booking path ---
      const { data: instance, error: instanceErr } = await adminClient
        .from("class_instances")
        .select("id, studio_id, price, status, max_capacity, class_templates ( name )")
        .eq("id", class_instance_id)
        .eq("status", "scheduled")
        .single();
      if (instanceErr || !instance) return json(req, { error: "Class not found or not schedulable" }, 404);
      const className = (instance as any).class_templates?.name ?? "Class";

      // Capacity check: count pending + confirmed bookings (UNIQUE constraint is the hard stop)
      const { count: bookingCount } = await adminClient
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("class_instance_id", class_instance_id)
        .in("status", ["pending", "confirmed"]);
      if (instance.max_capacity > 0 && (bookingCount ?? 0) >= instance.max_capacity) {
        return json(req, { error: "This class is fully booked" }, 409);
      }

      const { data: studio } = await adminClient
        .from("studios")
        .select("currency, app_url")
        .eq("id", instance.studio_id)
        .single();

      studioId = instance.studio_id;
      const guardErr = await validateStudioMatch(req, adminClient, studioId);
      if (guardErr) return guardErr;
      currency = (studio as any)?.currency ?? "NOK";
      studioAppUrl = (studio as any)?.app_url ?? null;
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
          return json(req, { error: message }, 409);
        }
        // Send confirmation email (best-effort — don't fail the booking if email fails)
        await sendCreditBookingEmail(adminClient, bookingId as string, user, studioId).catch(console.error);
        return json(req, { booking_id: bookingId, free: true });
      }
    } else {
      // --- Product purchase path ---
      const { data: product, error: productErr } = await adminClient
        .from("products")
        .select("id, studio_id, name, type, price_minor, currency, requires_contact, is_active, billing_interval")
        .eq("id", product_id)
        .single();
      if (productErr || !product) return json(req, { error: "Product not found" }, 404);
      if (!product.is_active) return json(req, { error: "Product is not available" }, 400);
      if (product.requires_contact) {
        return json(req, { error: "This product requires a personal consultation — please contact the studio" }, 400);
      }
      if (product.type === "drop_in") {
        return json(req, { error: "Drop-in classes must be booked from the schedule" }, 400);
      }

      studioId = product.studio_id;
      const guardErr = await validateStudioMatch(req, adminClient, studioId);
      if (guardErr) return guardErr;
      currency = product.currency;
      amountMinor = product.price_minor;
      description = product.name;
      resolvedProductId = product.id;
      extraMetadata = { product_id: product.id, product_type: product.type };

      // Look up per-studio canonical URL for the redirect default
      const { data: studioRow } = await adminClient
        .from("studios")
        .select("app_url")
        .eq("id", product.studio_id)
        .single();
      studioAppUrl = (studioRow as any)?.app_url ?? null;

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
      return json(req, { error: "This studio is not configured for online payment" }, 402);
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
    if (paymentErr || !payment) return json(req, { error: "Failed to create payment record" }, 500);

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
            .select("id, status, payment_id")
            .eq("user_id", user.id)
            .eq("class_instance_id", resolvedClassInstance.id)
            .single();
          if (existing?.status === "pending") {
            // Expire the old payment before reusing the booking slot. Without this,
            // the old Stripe session stays valid and can be completed by the browser,
            // charging the user a second time with no booking row to match.
            if (existing.payment_id) {
              await adminClient.from("payments").update({ status: "failed" }).eq("id", existing.payment_id);
            }
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
              return json(req, { error: "Failed to create booking record" }, 500);
            }
          } else {
            await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
            return json(req, { error: "You already have a booking for this class." }, 409);
          }
        } else {
          await adminClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
          return json(req, { error: "Failed to create booking record" }, 500);
        }
      } else {
        bookingId = booking.id;
      }
    }

    // --- Call provider adapter to create hosted checkout session ---
    const base = return_url ?? studioAppUrl ?? DEFAULT_APP_ORIGIN;
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
      return json(req, { error: `Payment provider error: ${err}` }, 502);
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

    return json(req, {
      checkout_url: checkoutResult.checkout_url,
      payment_id: payment.id,
      booking_id: bookingId,
    });
  } catch (err) {
    console.error("create-checkout error:", err);
    return json(req, { error: "Internal server error" }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function sendCreditBookingEmail(
  admin: ReturnType<typeof createClient>,
  bookingId: string,
  user: { id: string; email?: string },
  studioId: string,
) {
  if (!RESEND_API_KEY || !user.email) return;

  const idempotencyKey = `booking_confirmation_${bookingId}`;

  const [{ data: booking }, { data: studio }] = await Promise.all([
    admin.from("bookings").select(`
      id,
      class_instances (
        starts_at,
        class_templates ( name, default_duration_minutes ),
        instructors ( display_name ),
        locations ( name )
      )
    `).eq("id", bookingId).single(),
    admin.from("studios").select("name, from_email, locale, timezone").eq("id", studioId).single(),
  ]);
  if (!booking) return;

  const { error: logErr } = await admin.from("notification_log").insert({
    studio_id: studioId,
    user_id: user.id,
    booking_id: bookingId,
    channel: "email",
    template: "booking_confirmation",
    recipient: user.email,
    idempotency_key: idempotencyKey,
  });
  if (logErr?.code === "23505") return; // already sent
  if (logErr) { console.error("notification_log insert error:", logErr); return; }

  const ci = (booking as any).class_instances;
  const startsAt = new Date(ci.starts_at);
  const duration = ci.class_templates?.default_duration_minutes ?? 60;
  const className = ci.class_templates?.name ?? "Your class";
  const instructor = ci.instructors?.display_name ?? "";
  const location = ci.locations?.name ?? "";
  const studioName = (studio as any)?.name ?? "Yoga Studio";
  const studioFromEmail: string = (studio as any)?.from_email ?? FROM_EMAIL;
  const locale: string = (studio as any)?.locale ?? "nb-NO";
  const timezone: string = (studio as any)?.timezone ?? "Europe/Oslo";

  const dateStr = startsAt.toLocaleDateString(locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: timezone,
  });
  const timeStr = startsAt.toLocaleTimeString(locale, {
    hour: "2-digit", minute: "2-digit", timeZone: timezone,
  });

  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const fmtIso = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calParams = new URLSearchParams({
    action: "TEMPLATE",
    text: className,
    dates: `${fmtIso(startsAt)}/${fmtIso(endsAt)}`,
    ...(location ? { location } : {}),
  });
  const calendarUrl = `https://calendar.google.com/calendar/render?${calParams}`;

  const html = buildConfirmationEmail({ studioName, className, dateStr, timeStr, instructor, location, duration, calendarUrl });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: studioFromEmail,
      to: [user.email],
      subject: `Booking confirmed — ${className}`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error (credit booking):", errText);
    await admin.from("notification_log").update({ error: errText }).eq("idempotency_key", idempotencyKey);
  }
}

