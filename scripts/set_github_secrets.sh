#!/usr/bin/env bash
# Copies the database login from your local .env into GitHub repository secrets,
# so the nightly workflow can connect. Values are piped straight in and never printed.
# Needs the GitHub CLI (gh) to be logged in:  gh auth login
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

for name in SUPABASE_DB_HOST SUPABASE_DB_PORT SUPABASE_DB_NAME SUPABASE_DB_USER SUPABASE_DB_PASSWORD; do
  printf '%s' "${!name}" | gh secret set "$name" --repo ameya1198/courtside-analytics
  echo "set $name"
done
