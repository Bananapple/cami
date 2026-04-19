# Brie — Yoga Studio SaaS

A website and booking engine for Norwegian yoga studios. Each studio gets their own isolated Supabase project and branded deployment. Studio owners pay a flat monthly SaaS fee; student payments go directly to each studio.

Built with React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, and Supabase.

**First customer:** YogaBrie / Mysore Oslo — Brageveien 5 A, 0358 Oslo.

---

## Quick start

```bash
cp .env.example .env       # fill in Supabase + Stripe keys
npm install
npm run dev                # localhost:8080 (or next available port)
```

## Provisioning a new studio

```bash
./scripts/new-studio.sh
```

Creates a new Supabase project (eu-north-1), runs migrations, seeds `studio_config`, and generates `.env.<studio-slug>`. Requires `supabase` CLI, `jq`, and `supabase login`.

After provisioning, seed the sessions table — see **CLAUDE.md → Seeding Sessions** for the full SQL.

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
VITE_STRIPE_PUBLISHABLE_KEY
```

Never commit `.env` — it is gitignored. Use `.env.example` as the template.

## Architecture notes

See **CLAUDE.md** for full architecture, booking flow, database schema, and per-studio branding details.

## Deferred work

See **TODOS.md** for known gaps: Stripe/Vipps purchasing, cancellation/refund policy, timezone handling, multi-studio migration tooling.
