# Architecture

## Two surfaces, one repo

This repo serves two distinct surfaces from one React codebase:

| Surface | Domain(s) | What it is |
|---|---|---|
| **Marketing** | `heycami.studio`, `www.heycami.studio` | The Cami SaaS marketing site. Sells the platform to studio operators. |
| **Studio** | every studio deployment (`brie-hd7s.vercel.app`, future studio domains, Vercel previews) | The actual booking + management product a studio runs for its members. |

Same Vercel build, same Supabase project. The runtime decides which surface to render based on `window.location.hostname` — see `src/marketing/isMarketingHost.ts`.

## Why this split exists

Before this split, every deployment rendered every route. `heycami.studio/manage` rendered the staff console (returned "not authorised" because the visitor wasn't a member of the nonexistent "Cami" studio). `heycami.studio/dashboard` mounted the user dashboard. Both were nonsensical: heycami isn't a yoga studio. The marketing site does not have members, classes, bookings, or a `studios` row.

Hostname gating makes the boundary an enforceable runtime invariant rather than an implicit convention: on a marketing host, the studio routes literally do not exist in the route tree. There is no StudioProvider. There are no studio queries. A typed-in `/manage` URL redirects to `/`.

## The boundary rules

```
src/marketing/   ──→  src/components/ui/   (shared UI primitives only)
src/marketing/   ─✗→  any other src/* code
```

Marketing pages live under `src/marketing/` and may **only** import:
- React stdlib (`react`, `react-dom`)
- Routing primitives (`react-router-dom`) — but should rarely need them
- Shared UI primitives (`src/components/ui/*`) — design-system pieces
- Each other (other files under `src/marketing/`)

Marketing pages may **not** import:
- `@/context/StudioContext` or any studio context
- `@/hooks/*` (every studio hook depends on `useStudioContext` or `useAuth`)
- `@/integrations/supabase/*` — marketing has no DB queries
- `@/components/Header`, `@/components/Footer`, `@/components/booking/*` — these are studio-flow components
- Anything under `@/manage`, `@/manage-v2`, `@/pages` — these are all studio-app surfaces

`App.tsx` and the entry point are the only files that may import from both sides — they sit above the boundary, not inside it.

The studio app, conversely, is allowed to import marketing pages (e.g. the studio app exposes `/cami` as a preview route on non-marketing hosts). The boundary is **one-way**.

## What's where

| Path | Surface |
|---|---|
| `src/marketing/CamiHome.tsx` | The heycami.studio hero page. |
| `src/marketing/isMarketingHost.ts` | The single source of truth for "are we on the marketing domain?". Used by `App.tsx` for routing and by the `deploy-cami` body class for typography. |
| `src/App.tsx` | Top-level switch: `isMarketingHost() ? <MarketingApp /> : <StudioApp />`. Two route trees, two provider stacks. |
| `src/pages/*` | Studio app pages (Index, Dashboard, JoinNow, Programs, Coaches, Insights, ArticleDetail, NotFound, AuthCallback). |
| `src/manage/*`, `src/manage-v2/*` | Studio staff console. |
| `src/components/booking/*` | Studio booking-flow components (AuthForm, BookingSheet, etc.). |
| `src/components/ui/*` | Shared design-system primitives (button, dialog, sheet, liquid-glass-button). Importable from both surfaces. |

## Why not gate on `import.meta.env.VITE_DEPLOY_TARGET`?

We did, briefly. The Cami Vercel project sets `VITE_DEPLOY_TARGET=cami` and the studio Vercel projects don't, so it mostly worked. But:

1. **The semantic is wrong.** `VITE_DEPLOY_TARGET` answers "what build am I?", not "which surface is the user on?". The user-facing question is the right one to gate on.
2. **Env can drift.** If a Vercel project's env var is set incorrectly, the gating breaks silently. Hostname is observable at runtime and matches what the user actually sees.
3. **Vercel preview deployments.** Preview URLs don't carry production env vars consistently, and we want preview behaviour to mirror production behaviour for the host the user is actually on.

`isMarketingHost()` reads `window.location.hostname`. No build-time variance.

## Trigger conditions for splitting into two repos

This single-repo arrangement is intended as **scaffolding** for an eventual two-repo split. Move when one or more of the following becomes true:

1. **Marketing has its own dependency tree.** When marketing wants animation libraries, marketing-site CMS clients, or analytics SDKs that the studio app shouldn't pull, the bundle savings + isolation become worth it. Today both sides share the same `node_modules`.
2. **Marketing iteration speed is constrained by studio app build/test time.** If the marketing team is waiting on a 3-minute CI run to ship a copy change to a hero, the seam is costing more than it saves.
3. **The marketing surface accumulates its own routes (>5 pages) or its own backend.** Today CamiHome is a single page. When there's a `/pricing`, `/case-studies`, `/blog`, `/api/lead-capture`, etc., marketing has earned its own home.
4. **Studio operators want to white-label.** If a studio wants to host the booking app under their own branding without any reference to "Cami", we need to be sure no marketing assets leak in. A separate repo makes that bulletproof.

When the split happens, the work is mechanical because the boundary is already enforced:
- Move `src/marketing/` + needed `src/components/ui/*` to a new repo
- Move `docs/BRAND.md` (marketing's territory) to it
- Set up its own Vercel project pointed at `heycami.studio`
- Drop `src/marketing/`, `MarketingApp`, and the hostname check from this repo
- Studio app's existing `/cami` preview route disappears or becomes a static link

## Auth implications on the marketing host

There is no "Log in" button on `heycami.studio` today. A studio operator who wants to manage their studio navigates directly to their studio's URL (e.g. `https://brie-hd7s.vercel.app/dashboard`) and signs in there. This matches the per-deployment auth model the rest of the app already uses.

The alternative — **centralized auth + studio picker** — is a roadmap item, not a current goal. It would require:
- A `studios` row for "Cami" itself (or a parallel routing layer)
- Cross-domain session strategy (Supabase auth cookies are domain-scoped)
- A picker UI driven by the user's `studio_members` rows
- Decisions about what staff with multiple studios see by default

When the time comes for centralized auth, the marketing surface will already be carved out for it.
