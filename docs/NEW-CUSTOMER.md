# New Customer Onboarding

Run through this top-to-bottom for every new studio. Steps are ordered by dependency.

If you're scripting it: `scripts/provision-studio.ts` does steps 1–3 in one command and prints the rest as a checklist. Steps 4–8 below are the manual operational pieces.

---

## 0. Prerequisites you need from the customer

- Their **studio name** (display) and **URL slug** (URL-safe identifier — lowercase, hyphens)
- Their **contact email**
- Their **branding**: primary hex color, logo (you handle assets separately)
- Their **physical address** (used in booking confirmations)
- Their **timezone** (default `Europe/Oslo`) and **currency** (default `NOK`)
- A **Stripe account** they own (or willingness to onboard via your Stripe Connect platform)
- A **domain** they own (`booking.theirstudio.com` or similar)

---

## 1. Database — provision the studio

Either run the script:

```bash
SUPABASE_URL=https://xskqpxfjhhxontirezjd.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
bun run scripts/provision-studio.ts \
  --slug=fooyoga \
  --name="Foo Yoga" \
  --email=hello@fooyoga.no \
  --primary-color="#8a7e6e" \
  --address="Oslo, Norway" \
  --app-url=https://fooyoga.no \
  --from-email=booking@fooyoga.no
```

Or paste the equivalent SQL into Supabase → SQL Editor:

```sql
WITH new_studio AS (
  INSERT INTO studios (slug, name, contact_email, primary_color, currency, timezone, address, app_url, from_email, is_active)
  VALUES ('fooyoga', 'Foo Yoga', 'hello@fooyoga.no', '#8a7e6e', 'NOK', 'Europe/Oslo', 'Oslo, Norway', 'https://fooyoga.no', 'booking@fooyoga.no', true)
  RETURNING id
)
INSERT INTO studio_payment_providers (studio_id, provider, is_primary, is_active)
SELECT id, 'stripe', true, false FROM new_studio;
```

Then capture the new `studios.id` for the steps below.

---

## 2. Vercel — create the deployment

1. Vercel Dashboard → **Add New Project** → import from GitHub (`Bananapple/cami`)
2. **Environment Variables** (Production scope, no quotes):
   ```
   VITE_SUPABASE_URL              = https://xskqpxfjhhxontirezjd.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY  = <anon key from Supabase>
   VITE_STUDIO_SLUG               = fooyoga
   ```
3. Deploy — do **not** "Redeploy from cache" after setting env vars
4. Connect the customer's custom domain in Vercel → Settings → Domains

---

## 3. Supabase — auth redirect URL

Authentication → URL Configuration → Redirect URLs → add:

```
https://fooyoga.no/**
https://[vercel-deployment].vercel.app/**   ← also add the .vercel.app URL for testing
```

This is required for SSO popups to close correctly. Without it, OAuth bounces to the platform-level Site URL and the popup errors.

(Google + Apple OAuth credentials don't need updating — they only talk to the Supabase callback URL, same for all studios.)

---

## 4. Edge Function secrets — append to APP_URL allowlist

`APP_URL` is a comma-separated list used for two things: CORS allow-origin echo, and `return_url` validation in `create-checkout`. **Append** the new origin, don't replace:

```bash
# Get the current value
supabase secrets list --project-ref xskqpxfjhhxontirezjd | grep APP_URL

# Set with the new origin appended (use the actual current value from above)
supabase secrets set APP_URL="https://brie-hd7s.vercel.app,https://www.heycami.studio,https://fooyoga.no" \
  --project-ref xskqpxfjhhxontirezjd

# Redeploy create-checkout (it reads APP_URL at startup)
supabase functions deploy create-checkout --project-ref xskqpxfjhhxontirezjd
```

You only need to redeploy `create-checkout` — the other Edge Functions read the same env via the shared `_shared/cors.ts` helper but only use it for response headers, which work correctly even if a few warm instances serve the old value briefly.

---

## 5. Stripe — connect the customer's account

Use **Stripe Connect** (NOT separate Stripe accounts per studio):

1. **Customer goes through Stripe Connect onboarding** from your platform dashboard. They authorize your platform to charge on their behalf.
2. **Note the connected account ID** (`acct_xxx`) Stripe returns.
3. **Update the placeholder row**:
   ```sql
   UPDATE studio_payment_providers
      SET provider_account_id = 'acct_xxx',
          is_active           = true,
          onboarded_at        = now()
    WHERE studio_id = '<studio-id-from-step-1>';
   ```
4. **Webhook**: the platform webhook (`/functions/v1/payment-webhook/stripe`) is shared across all Connect accounts. No per-customer webhook setup. The webhook handler reads `event.account` from the Stripe payload and resolves the studio via `studio_payment_providers.provider_account_id`.

If you don't yet have Connect set up at the platform level (sandbox testing), you can run customers on the platform's main Stripe account by leaving `provider_account_id` NULL and setting `is_active=true`. But this means all charges land in your account — only OK for testing or if you ARE the customer (Brie's first studio is configured this way).

---

## 6. Resend — verify the customer's sending domain

1. Resend Dashboard → **Domains** → Add domain (e.g. `fooyoga.no`)
2. Customer adds the DKIM/SPF DNS records Resend shows
3. Wait for verification (~1 hour usually)
4. Once verified, the customer's `booking@fooyoga.no` (or whatever) is a valid FROM address. The `studios.from_email` column you set in step 1 will then route their emails through that address.

If `studios.from_email` is null OR the domain isn't verified yet, all their emails fall back to whatever is in the `FROM_EMAIL` env var (currently `onboarding@resend.dev`, the platform sandbox sender).

---

## 7. Owner promotion

The customer signs up on their site (`https://fooyoga.no`) via OTP. This creates an `auth.users` row + auto-upserts a `studio_members` row with `role='member'` (per the `create-checkout` function on first booking, or via direct sign-up flow).

Promote them to owner:

```bash
SUPABASE_URL=https://xskqpxfjhhxontirezjd.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
bun run scripts/promote-owner.ts \
  --slug=fooyoga \
  --email=customer@fooyoga.no
```

Or by hand:
```sql
INSERT INTO studio_members (studio_id, user_id, role, is_active)
SELECT s.id, u.id, 'owner', true
  FROM studios s, auth.users u
 WHERE s.slug = 'fooyoga' AND u.email = 'customer@fooyoga.no'
ON CONFLICT (studio_id, user_id) DO UPDATE SET role = 'owner', is_active = true;
```

They may need to sign out + back in (or wait ~5 min for React Query cache) to see `/manage` unlock.

---

## 8. Smoke-test the new deployment

- [ ] **Home page** loads with their branding and colors
- [ ] **OTP sign-in** works (check spam if email doesn't arrive)
- [ ] **SSO sign-in** popup closes correctly and lands them back on the dashboard
- [ ] **Drop-in booking** with Stripe test card `4242 4242 4242 4242` confirms within ~5 sec, confirmation email arrives
- [ ] **Email link** in the confirmation goes to `https://fooyoga.no` (not `brie-hd7s` or wrong studio)
- [ ] **Email FROM** address is `booking@fooyoga.no` (or fallback `onboarding@resend.dev` if you haven't done step 6 yet)
- [ ] **`/manage`** loads when signed in as the owner; gives "Not authorised" when signed in as a regular member
- [ ] **Membership purchase** with the same test card creates an active membership row
- [ ] **Cancel a paid booking** issues a Stripe refund (visible in the customer's Stripe Connect dashboard)

---

## Teardown (if needed)

```sql
DO $$
DECLARE
  sid UUID;
BEGIN
  SELECT id INTO sid FROM studios WHERE slug = 'target-slug';
  IF sid IS NULL THEN RAISE NOTICE 'No studio found'; RETURN; END IF;

  -- Delete users that are ONLY members of this studio (not your own staff).
  -- This does NOT touch users who are members of other studios.
  DELETE FROM auth.users
   WHERE id IN (
     SELECT user_id FROM studio_members
      WHERE studio_id = sid
        AND user_id NOT IN (
          SELECT user_id FROM studio_members WHERE studio_id != sid
        )
   );

  -- Cascades to all child tables via FK ON DELETE CASCADE
  DELETE FROM studios WHERE id = sid;
END $$;
```

> Pre-flight: dump `studios`, `bookings`, `payments` for that studio if you want a backup.
> Don't forget to also remove the customer's URL from `APP_URL` secret + delete their Vercel project.
