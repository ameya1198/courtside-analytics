# Nightly refresh

The workflow `.github/workflows/refresh.yml` keeps the warehouse current.

## What it does (in order)

1. Checks the database connection.
2. Loads the current season's game logs (`--current`).
3. Loads new shots (`--shots`, only from 3 days before the newest shot we have).
4. `dbt deps`, then `dbt source freshness` (warns only), then `dbt build` (models and tests).

If any step fails, the run fails and GitHub emails you. A failing dbt test also fails the run.

## When it runs

- 09:00 UTC every day from October to June (3-4 am US Central, after the last West Coast game).
- By hand: GitHub > Actions > Nightly refresh > Run workflow.

## One-time setup

Add the five database settings as repository secrets. The script copies them from your local `.env`
without printing them:

```bash
gh auth login               # once
./scripts/set_github_secrets.sh
```

## Known risk: the NBA website may block GitHub's servers

stats.nba.com sometimes refuses traffic from cloud providers. If the load steps time out only on
GitHub (they work on your laptop), the options are:

1. Route requests through a proxy (nba_api accepts a `proxy` argument).
2. Run the load on your own computer on a schedule, and keep GitHub Actions only for `dbt build`.
3. Switch the game log load to hoopR (R), which uses a different route to the same data.

## Why a lookback instead of "only new games"

Stat corrections arrive a day or two after a game. Reloading the last 3 days of shots and the last
7 days of game facts catches them without re-downloading the whole season.
