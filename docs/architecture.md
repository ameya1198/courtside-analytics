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
- Free tier budget is 500 MB. Raw shot data is kept for the current and previous season only. Older seasons are rolled up by player, season and zone.
- Every dbt model has tests. A failing test blocks the dashboard rebuild.

## Audience

Front-office decision makers. Page plan lives in `docs/pages.md`.
