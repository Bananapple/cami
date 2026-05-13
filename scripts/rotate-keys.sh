#!/usr/bin/env bash
# Rotate legacy Supabase keys to modern sb_publishable_* / sb_secret_* keys.
#
# What this script does:
#   1. Prompts for the two new keys (input hidden)
#   2. Updates .env  (VITE_SUPABASE_PUBLISHABLE_KEY)
#   3. Updates .env.local  (SUPABASE_SERVICE_ROLE_KEY)
#   4. Updates GitHub secrets (SEED_SUPABASE_ANON_KEY, SEED_SUPABASE_SERVICE_ROLE_KEY)
#   5. Updates Vercel env var (VITE_SUPABASE_PUBLISHABLE_KEY) on both projects
#   6. Triggers redeployments
#
# Before running: get the new keys from
#   Supabase dashboard → Settings → API → default tab (not "Legacy API keys" tab)
#
# After running:
#   - Smoke-test a booking flow on both brie and cami deployments
#   - If OK → go to Supabase dashboard and click "Disable legacy API keys"
#   - Immediately retest both deployments

set -euo pipefail

REPO="Bananapple/cami"
ENV_FILE="$(dirname "$0")/../.env"
ENV_LOCAL_FILE="$(dirname "$0")/../.env.local"

# Vercel project IDs (bananapple / nicholas-de-vibes-projects)
VERCEL_ORG_ID="team_mRRZ2Q4c5ONMPUN4uSAtMpxE"
VERCEL_BRIE_PID="prj_PShWhF7dA2r8CUO5xCme50wzUQri"
VERCEL_CAMI_PID="prj_t7kL4knRYLRmx5HTlg3GzbcdFK0m"

echo ""
echo "=== Supabase Key Rotation ==="
echo ""
echo "Retrieve keys from: Supabase dashboard → Settings → API → (default tab)"
echo "  Publishable key looks like: sb_publishable_..."
echo "  Secret key looks like:      sb_secret_..."
echo ""

# Read new publishable key (replaces legacy anon key)
printf "New publishable key (sb_publishable_...): "
read -rs NEW_PUBLISHABLE
echo ""

# Read new secret key (replaces legacy service_role key)
printf "New secret key (sb_secret_...): "
read -rs NEW_SECRET
echo ""

# Basic format validation
if [[ "$NEW_PUBLISHABLE" != sb_publishable_* ]]; then
  echo "ERROR: publishable key should start with 'sb_publishable_'" >&2
  exit 1
fi
if [[ "$NEW_SECRET" != sb_secret_* ]]; then
  echo "ERROR: secret key should start with 'sb_secret_'" >&2
  exit 1
fi

echo ""
echo "--- Phase 1: Local env files ---"

# Update .env: VITE_SUPABASE_PUBLISHABLE_KEY
if grep -q "VITE_SUPABASE_PUBLISHABLE_KEY" "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=$NEW_PUBLISHABLE|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  echo "  ✓ .env VITE_SUPABASE_PUBLISHABLE_KEY updated"
else
  echo "  SKIP .env: VITE_SUPABASE_PUBLISHABLE_KEY not found (check manually)"
fi

# Update .env.local: SUPABASE_SERVICE_ROLE_KEY
if grep -q "SUPABASE_SERVICE_ROLE_KEY" "$ENV_LOCAL_FILE" 2>/dev/null; then
  sed -i.bak "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$NEW_SECRET|" "$ENV_LOCAL_FILE"
  rm -f "${ENV_LOCAL_FILE}.bak"
  echo "  ✓ .env.local SUPABASE_SERVICE_ROLE_KEY updated"
else
  echo "  SKIP .env.local: SUPABASE_SERVICE_ROLE_KEY not found (check manually)"
fi

echo ""
echo "--- Phase 2: GitHub secrets ---"

echo -n "$NEW_PUBLISHABLE" | gh secret set SEED_SUPABASE_ANON_KEY --repo "$REPO" --body -
echo "  ✓ SEED_SUPABASE_ANON_KEY updated"

echo -n "$NEW_SECRET" | gh secret set SEED_SUPABASE_SERVICE_ROLE_KEY --repo "$REPO" --body -
echo "  ✓ SEED_SUPABASE_SERVICE_ROLE_KEY updated"

echo ""
echo "--- Phase 3: Vercel env vars ---"

# vercel env requires a project-linked directory; we create a throw-away temp
# dir with a .vercel/project.json pointing at each project in turn.
for ENTRY in "brie:$VERCEL_BRIE_PID" "cami:$VERCEL_CAMI_PID"; do
  PROJECT="${ENTRY%%:*}"
  PID="${ENTRY##*:}"

  VDIR="$(mktemp -d)"
  mkdir -p "$VDIR/.vercel"
  printf '{"projectId":"%s","orgId":"%s"}' "$PID" "$VERCEL_ORG_ID" \
    > "$VDIR/.vercel/project.json"

  for ENV_TARGET in production preview; do
    echo "$NEW_PUBLISHABLE" \
      | npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY "$ENV_TARGET" \
          --force --yes --cwd "$VDIR" 2>/dev/null \
      && echo "  ✓ $PROJECT VITE_SUPABASE_PUBLISHABLE_KEY ($ENV_TARGET) updated" \
      || echo "  WARN: could not update $PROJECT ($ENV_TARGET) — set manually in Vercel dashboard"
  done

  rm -rf "$VDIR"
done

echo ""
echo "--- Phase 4: Trigger redeployments ---"

for ENTRY in "brie:$VERCEL_BRIE_PID" "cami:$VERCEL_CAMI_PID"; do
  PROJECT="${ENTRY%%:*}"
  PID="${ENTRY##*:}"

  DEPLOY_URL=$(npx vercel api "/v6/deployments?projectId=$PID&target=production&limit=1" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['deployments'][0]['url'])" 2>/dev/null \
    || echo "")

  if [[ -n "$DEPLOY_URL" ]]; then
    npx vercel redeploy "$DEPLOY_URL" --no-wait 2>/dev/null \
      && echo "  ✓ $PROJECT redeploy triggered" \
      || echo "  WARN: could not trigger $PROJECT redeploy — deploy manually from Vercel dashboard"
  else
    echo "  WARN: could not resolve latest deployment for $PROJECT — redeploy manually"
  fi
done

echo ""
echo "=== Done ==="
echo ""
echo "Next steps (manual):"
echo "  1. Wait for Vercel deployments to finish"
echo "  2. Smoke-test a booking on https://brie-hd7s.vercel.app"
echo "  3. If OK → Supabase dashboard → Settings → API → click 'Disable legacy API keys'"
echo "  4. Immediately retest the booking flow"
echo "  5. If broken after disable: re-enable legacy, then set SUPABASE_SERVICE_ROLE_KEY as"
echo "     a custom secret in each edge function and re-disable"
echo ""
