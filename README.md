# Brie — Yoga Studio SaaS

A website and booking engine for yoga studios in Scandinavia, Europe and the US. Each studio gets their own isolated Supabase project and branded deployment. Studio owners pay a flat monthly SaaS fee; student payments go directly to each studio.

Built with React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, and Supabase.

**First customer:** YogaBrie / Mysore Oslo — Brageveien 5 A, 0358 Oslo.

---

## Quick start

```bash
cp .env.example .env       # fill in Supabase URL + anon key; set VITE_STUDIO_SLUG
npm install
npm run dev                # localhost:8080 (or next available port)
```

## Provisioning a new studio

In the v2 multi-tenant architecture (see `docs/MIGRATION-MULTITENANT.md`), adding a studio is an INSERT into the `studios` table — not a new Supabase project. Use `scripts/provision-studio.ts` to create the row and `scripts/promote-owner.ts` to promote the initial manager. The full runbook lives in `docs/NEW-CUSTOMER.md`. The legacy `./scripts/new-studio.sh` is retired.

## Key commands

```bash
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

## Environment variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_STUDIO_SLUG          # e.g. "yogabrie" — resolves the current tenant
```

Never commit `.env` — it is gitignored. Use `.env.example` as the template.
Stripe and other payment provider secrets live in Supabase Edge Function env, not here.

## Architecture notes

See **CLAUDE.md** for full architecture, booking flow, database schema, and per-studio branding details.

## Deferred work

See **TODOS.md** for known gaps: shop/membership purchasing, cancellation/refund policy, timezone handling, SMS OTP, multi-studio migration tooling.
