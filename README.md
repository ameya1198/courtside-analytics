# Courtside Analytics

A live NBA decision dashboard for front-office questions: who is outperforming their contract, how rest changes results, and how teams are trending.

Built as an end-to-end analytics project: Python ingestion, Supabase Postgres warehouse, dbt models and tests, GitHub Actions scheduling, and an Evidence dashboard.

> Unofficial project. Not affiliated with or endorsed by the NBA.

## Stack

| Layer | Tool |
|---|---|
| Ingestion | Python (`nba_api`, NBA live feed) |
| Warehouse | Supabase Postgres (`raw` > `staging` > `marts`) |
| Transform and test | dbt Core (`dbt-postgres`) |
| Orchestration | GitHub Actions |
| Dashboard | Evidence |

## Repo layout

```
ingestion/   Python loaders into the raw schema
dbt/         dbt project (staging, intermediate, marts, tests)
dashboard/   Evidence app
sql/         One-time warehouse setup (schemas, log tables)
docs/        Architecture, page specs, data dictionary
.github/     CI and scheduled workflows
```

## Setup

1. Create a Supabase project, then run `sql/001_schemas.sql` and `sql/003_raw_tables.sql` in the SQL editor.
2. `cp .env.example .env` and fill in the connection details.
3. `python -m venv .venv && source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. `make check-db` to confirm the connection works.
6. `make load-reference`, then `python -m ingestion.load --season 2025` as a first test.
7. `make backfill` to load every season (run once).

## Status

- [x] Phase 0: repo and warehouse setup
- [x] Phase 1: ingestion and history backfill (11 seasons loaded)
- [ ] Phase 2: dbt staging and core models (project scaffolded, models in progress)
- [ ] Phase 3: intermediate models, macros, incremental loads
- [ ] Phase 4: analysis marts
- [ ] Phase 5: scheduled refresh
- [ ] Phase 6: dashboard
