# New Customer Onboarding Checklist

Run through this top-to-bottom for every new studio. Steps are ordered by dependency.

---

## 1. Supabase — studio row + data

Run `scripts/seed-demo-studio.sql` as a template, or paste equivalent SQL into Supabase → SQL Editor:

```sql
-- Step 1: studio skeleton
INSERT INTO studios (slug, name, primary_color, timezone, currency, address, contact_email)
VALUES ('new-slug', 'Studio Name', '#hexcolor', 'Europe/Oslo', 'NOK', 'City', 'hello@studio.no')
ON CONFLICT (slug) DO NOTHING;
```

Then inside a `DO $$ ... $$` block:
- Location
- Instructors (with `specialty`)
- Class templates (with `level`, `default_duration_minutes`, `default_price`, `default_max_capacity`)
- Schedule rules (with `effective_from = CURRENT_DATE` or earlier if you want past history)
- `PERFORM materialize_class_instances(sid, CURRENT_DATE, CURRENT_DATE + 90);`
- Products (drop_in, clip_card, subscription)

---

## 2. Supabase — allow the new site's redirect URL

**Authentication → URL Configuration → Redirect URLs → Add:**
```
https://[customer-domain].vercel.app/**
```

This is required for Google/Apple SSO to work on the new site. Without it, OAuth redirects fall back to the Site URL and the popup errors.

> Google and Apple OAuth credentials do NOT need updating — they only talk to the Supabase callback URL, which is the same for all studios.

---

## 3. Vercel — new project

1. Vercel dashboard → **Add New Project** → import from GitHub (`Bananapple/brie`)
2. Set environment variables (Production scope):
   ```
   VITE_SUPABASE_URL               = <same for all studios>
   VITE_SUPABASE_PUBLISHABLE_KEY   = <same for all studios>
   VITE_STUDIO_SLUG                = new-slug
   ```
3. Deploy — do **not** use "Redeploy from cache" after env var changes
4. Optionally add a custom domain

---

## 4. Payment provider — Stripe

1. Create a new Stripe account for the studio (each studio collects payments directly — no marketplace layer)
2. Set Edge Function secrets for this deployment:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref <ref>
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref <ref>
   ```
3. Register a Stripe webhook pointing to `https://[project-ref].supabase.co/functions/v1/payment-webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `charge.refunded`

---

## 5. Email (Resend)

1. Add the studio's sending domain in Resend → Domains
2. Set the `FROM_EMAIL` secret:
   ```bash
   supabase secrets set FROM_EMAIL=booking@studio.no --project-ref <ref>
   ```
3. Set `APP_URL` to the live Vercel URL (used to validate `return_url` in `create-checkout`):
   ```bash
   supabase secrets set APP_URL=https://[customer-domain].vercel.app --project-ref <ref>
   ```

---

## 6. Add yourself (or the studio owner) as manager

After signing up on the new site, find your UUID in Supabase → Authentication → Users, then:

```sql
INSERT INTO studio_members (studio_id, user_id, role, total_sessions, level, joined_at)
SELECT s.id, '<YOUR_UUID>', 'manager', 0, 'STARTER', now()
FROM studios s WHERE s.slug = 'new-slug'
ON CONFLICT (studio_id, user_id) DO UPDATE SET role = 'manager';
```

---

## 7. Verification checklist

- [ ] Public site loads with correct studio branding and colors
- [ ] Booking sheet shows classes for the next 14 days
- [ ] OTP email auth works (check spam if not received)
- [ ] Google SSO works end-to-end (popup closes, booking continues)
- [ ] Drop-in Stripe checkout completes and confirmation email arrives
- [ ] `/manage` → Today screen shows today's classes
- [ ] `/manage` → Clients shows members
- [ ] Membership purchase flow works (clip card or subscription)

---

## Teardown (if needed)

```sql
DO $$
DECLARE sid UUID;
BEGIN
  SELECT id INTO sid FROM studios WHERE slug = 'target-slug';
  DELETE FROM auth.users WHERE id IN (
    SELECT user_id FROM studio_members WHERE studio_id = sid AND role != 'manager'
  );
  DELETE FROM studios WHERE id = sid; -- cascades to all child tables
END $$;
```

> Only deletes non-manager users. Adjust if you want a full wipe.
