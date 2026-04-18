#!/usr/bin/env bash
# new-studio.sh — Provisions a new yoga studio deployment
#
# What it does:
#   1. Creates a Supabase project in your org
#   2. Pushes the migrations (no `supabase link` needed — uses direct DB URL)
#   3. Seeds studio_config with the studio's name, location, and email
#   4. Writes a ready-to-use .env.<slug> file
#
# Usage:
#   ./scripts/new-studio.sh
#
# Prerequisites:
#   brew install supabase/tap/supabase jq

set -euo pipefail

# ── Dependency checks ────────────────────────────────────────────────────────

for cmd in supabase jq curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed."
    [[ "$cmd" == "supabase" ]] && echo "  Install: brew install supabase/tap/supabase"
    [[ "$cmd" == "jq" ]]       && echo "  Install: brew install jq"
    exit 1
  fi
done

# Check Supabase auth before prompting for anything
if ! supabase orgs list &>/dev/null; then
  echo "Error: Not logged in to Supabase. Run: supabase login"
  exit 1
fi

# ── Inputs ───────────────────────────────────────────────────────────────────

echo ""
echo "=== New Studio Setup ==="
echo ""

read -rp "Studio name (e.g. 'Oslo Yoga'): " STUDIO_NAME
read -rp "City / location (e.g. 'Oslo'): "   STUDIO_LOCATION
read -rp "Contact email: "                    STUDIO_EMAIL
echo -n  "DB password (min 16 chars, saved nowhere): "
read -rs DB_PASSWORD
echo ""

# Slugify: lowercase, spaces→hyphens, strip non-alphanumeric except hyphens
PROJECT_SLUG=$(echo "$STUDIO_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')

# Auto-select org ID if there's only one, otherwise prompt
ORGS_JSON=$(supabase orgs list --output json)
ORG_COUNT=$(echo "$ORGS_JSON" | jq 'length')

if [[ "$ORG_COUNT" -eq 1 ]]; then
  ORG_ID=$(echo "$ORGS_JSON" | jq -r '.[0].id')
  ORG_NAME=$(echo "$ORGS_JSON" | jq -r '.[0].name')
  echo ""
  echo "Using organisation: $ORG_NAME ($ORG_ID)"
else
  echo ""
  echo "Your Supabase organisations (use the ID column, not the name):"
  echo "$ORGS_JSON" | jq -r '.[] | "  \(.id)  \(.name)"'
  echo ""
  read -rp "Org ID: " ORG_ID
fi

# ── Create project ───────────────────────────────────────────────────────────

echo ""
echo "Creating project '$PROJECT_SLUG' in eu-north-1 (Stockholm)..."

PROJECT_JSON=$(supabase projects create "$PROJECT_SLUG" \
  --org-id "$ORG_ID" \
  --region eu-north-1 \
  --db-password "$DB_PASSWORD" \
  --output json)

PROJECT_REF=$(echo "$PROJECT_JSON" | jq -r '.id')
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo "Project created: $PROJECT_REF"

# ── Wait for provisioning ─────────────────────────────────────────────────────
# Supabase takes ~20-30s to provision a new project before accepting connections.

echo -n "Waiting for project to be ready"
for i in $(seq 1 6); do
  sleep 5
  echo -n "."
done
echo " done."

# ── Push migrations ───────────────────────────────────────────────────────────
# Uses --db-url directly so we don't overwrite supabase/config.toml
# (which would break the link to whichever project you last worked on).

echo "Pushing migrations..."
supabase db push --db-url "$DB_URL"

# ── Fetch API keys ────────────────────────────────────────────────────────────

echo "Fetching API keys..."
KEYS_JSON=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json)
ANON_KEY=$(echo "$KEYS_JSON"    | jq -r '.[] | select(.name == "anon")         | .api_key')
SERVICE_KEY=$(echo "$KEYS_JSON" | jq -r '.[] | select(.name == "service_role") | .api_key')

# ── Seed studio_config ────────────────────────────────────────────────────────

echo "Seeding studio config..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${SUPABASE_URL}/rest/v1/studio_config" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{
    \"studio_name\":    \"${STUDIO_NAME}\",
    \"location\":       \"${STUDIO_LOCATION}\",
    \"contact_email\":  \"${STUDIO_EMAIL}\"
  }")

if [[ "$HTTP_STATUS" != "201" ]]; then
  echo "Warning: studio_config seed returned HTTP $HTTP_STATUS — check Supabase dashboard."
else
  echo "Studio config seeded."
fi

# ── Write .env file ───────────────────────────────────────────────────────────

ENV_FILE=".env.${PROJECT_SLUG}"

cat > "$ENV_FILE" <<EOF
# Studio: ${STUDIO_NAME}
# Provisioned: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

VITE_SUPABASE_URL="${SUPABASE_URL}"
VITE_SUPABASE_PUBLISHABLE_KEY="${ANON_KEY}"

# Add the studio's payment processor public key here
# Stripe: https://dashboard.stripe.com/apikeys
# Nets Easy: https://portal.dibspayment.eu/
VITE_STRIPE_PUBLISHABLE_KEY=""
EOF

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=================================================="
echo "  ${STUDIO_NAME} is ready!"
echo "=================================================="
echo ""
echo "  Supabase project : ${PROJECT_REF}"
echo "  Dashboard        : https://supabase.com/dashboard/project/${PROJECT_REF}"
echo "  Env file         : ${ENV_FILE}"
echo ""
echo "Next steps:"
echo "  1. Add VITE_STRIPE_PUBLISHABLE_KEY to ${ENV_FILE}"
echo "  2. Add the Stripe secret key in Supabase dashboard:"
echo "     → Edge Functions → Secrets → STRIPE_SECRET_KEY"
echo "  3. Deploy: cp ${ENV_FILE} .env && vercel --prod (or your host)"
echo "  4. Replace src/assets/ images with ${STUDIO_NAME}'s photos"
echo ""
echo "  Service role key (keep secret — only for seeding/admin scripts):"
echo "  ${SERVICE_KEY}"
echo ""
