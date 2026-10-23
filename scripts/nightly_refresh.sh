#!/bin/zsh
# Nightly refresh, run on this Mac by launchd (stats.nba.com blocks cloud runners, so it cannot run on GitHub).
# The same steps as .github/workflows/refresh.yml. Logs go to ~/Library/Logs/courtside-refresh.log.
# launchd starts it every 15 minutes; see the checks below for when it actually runs.
# A failed run posts a macOS notification and is tried again, up to three times a day.

set -u
REPO="$HOME/Projects/courtside-analytics"
PY="$REPO/.venv/bin/python"
DBT="$REPO/.venv/bin/dbt"
LOCK="/tmp/courtside-refresh.lock"
STATE="$HOME/Library/Application Support/courtside"
LOG="$HOME/Library/Logs/courtside-refresh.log"
TODAY=$(date +%F)
mkdir -p "$STATE"

# launchd starts this every 15 minutes. It runs at most once a day, only while someone is using the Mac:
# a sleeping laptop wakes for a few seconds at a time ("dark wake"), and a run started then crawls
# along in those slices until the database drops the connection.
# --force (a manual run) skips these checks.
if [[ "${1:-}" != "--force" ]]; then
  [[ $(date +%H) -lt 5 ]] && exit 0                                     # last night's games are still finishing
  [[ "$(cat "$STATE/last_success" 2>/dev/null)" == "$TODAY" ]] && exit 0  # already refreshed today
  attempts=$(grep -c "^$TODAY$" "$STATE/attempts" 2>/dev/null)
  (( ${attempts:-0} >= 3 )) && exit 0                                   # three failures today; try again tomorrow
  ioreg -r -k AppleClamshellState -d 4 | grep -q '"AppleClamshellState" = Yes' && exit 0   # lid closed
  idle_s=$(( $(ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}') / 1000000000 ))
  (( idle_s > 1800 )) && exit 0                                         # nobody at the Mac for 30+ minutes
fi

# One run at a time (a scheduled run could overlap a manual one)
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date '+%F %T') another refresh is running, skipping"
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

# Keep the Mac awake for the few minutes the run takes
caffeinate -i -w $$ &

# A failed insert prints every row it tried, so keep the log from growing without limit
[[ -f "$LOG" && $(stat -f %z "$LOG") -gt 5000000 ]] && tail -c 1000000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
echo "$TODAY" >> "$STATE/attempts"

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
echo "$TODAY" > "$STATE/last_success"
echo "$(date '+%F %T') ===== refresh done"
