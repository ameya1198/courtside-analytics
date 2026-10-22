#!/bin/zsh
# Nightly refresh, run on this Mac by launchd (stats.nba.com blocks cloud runners, so it cannot run on GitHub).
# The same steps as .github/workflows/refresh.yml. Logs go to ~/Library/Logs/courtside-refresh.log.
# A failed run posts a macOS notification; the next run simply tries again.

set -u
REPO="$HOME/Projects/courtside-analytics"
PY="$REPO/.venv/bin/python"
DBT="$REPO/.venv/bin/dbt"
LOCK="/tmp/courtside-refresh.lock"

# One run at a time (a wake-up catch-up run could overlap a manual one)
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date '+%F %T') another refresh is running, skipping"
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

cd "$REPO" || exit 1
set -a; . ./.env; set +a

failed=()
step() {
  echo "$(date '+%F %T') == $*"
  "$@" && return 0
  # stats.nba.com rate-limits now and then; one retry after a pause clears most of it
  echo "$(date '+%F %T') failed, retrying in 60s"
  sleep 60
  "$@" || { failed+=("$*"); return 1; }
}

echo "$(date '+%F %T') ===== refresh start"
step "$PY" -m ingestion.db --check || { osascript -e 'display notification "Could not reach the database. Is the Supabase project paused?" with title "Courtside refresh failed"'; exit 1; }
for flag in --current --shots --extras --defense --rosters --preseason; do
  step "$PY" -m ingestion.load "$flag"
done

cd dbt || exit 1
step "$DBT" deps --quiet
"$DBT" source freshness || true   # warns only; the offseason is always stale
if step "$DBT" build; then
  # Clear the site's cached page queries so the new data shows now, not within the hour.
  # The local dev server is cleared too when it is running.
  for site in "${SITE_URL:-}" http://localhost:3000; do
    [[ -z "$site" ]] && continue
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 30 -X POST -H "Authorization: Bearer ${REVALIDATE_SECRET:-}" "$site/api/revalidate")
    echo "$(date '+%F %T') cache clear $site: $code"
    [[ "$site" == "${SITE_URL:-}" && "$code" != 200 ]] && failed+=("cache clear $site ($code)")
  done
fi

if (( ${#failed[@]} )); then
  echo "$(date '+%F %T') ===== refresh finished with failures: ${failed[*]}"
  osascript -e "display notification \"${#failed[@]} step(s) failed. See ~/Library/Logs/courtside-refresh.log\" with title \"Courtside refresh failed\""
  exit 1
fi
echo "$(date '+%F %T') ===== refresh done"
