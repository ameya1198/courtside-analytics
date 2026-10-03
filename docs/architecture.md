# Architecture

```
nba_api / NBA live feed
        |
        v
ingestion (Python)  -->  Supabase Postgres
                          raw      (as loaded, append only)
                          staging  (dbt views: clean names, types, dedupe)
                          marts    (dbt tables: facts, dimensions, analysis)
                                |
                                v
                          Evidence dashboard (Vercel)

GitHub Actions: nightly load > dbt source freshness > dbt build > dashboard rebuild
```

## Design rules

- Raw tables are never edited. Fixes happen in staging.
- Incremental loads keyed on game date. Backfill and daily runs use the same code path.
- Free tier budget is 500 MB. Raw shot data is kept for the last three seasons (SHOTS_START_SEASON, 2024 onward), about 90 MB. `fct_shots` is a view, so shot charts add no storage. Zone summaries are small tables.
- Every dbt model has tests. A failing test blocks the dashboard rebuild.

## Audience

Front-office decision makers. Page plan lives in `docs/pages.md`.
