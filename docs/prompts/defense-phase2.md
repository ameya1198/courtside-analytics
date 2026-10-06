# Defense, phase 2: individual defense data

Goal: fill the two "Not loaded yet" cards on the Defense tab (`web/app/defense/page.tsx`) with real player defense numbers, and add a defense card to Player Profile.
Phase 1 is done. It covers team rating, four factors, the opponent heatmap, and box-score defense per 36.
Read `web/app/defense/page.tsx`, `web/sql/defense.sql`, `ingestion/load.py` and `ingestion/nba_client.py` before starting. Follow the existing patterns. Do not rebuild what exists.

## 1. Load (stats.nba.com via nba_api, run here on the Mac)

Add client functions in `ingestion/nba_client.py`, wrapped in `_with_retries` with `timeout=60` like the clutch ones. Check the exact parameter names in the installed nba_api version before writing calls.

| Raw table | Endpoint | Grain | Key columns |
|---|---|---|---|
| `raw.player_on_off` | `TeamPlayerOnOffSummary` (one call per team, 30 per season) | player x team x season x on/off | MIN, OFF_RATING, DEF_RATING, NET_RATING, plus a `court_status` column ('on' / 'off') |
| `raw.player_defended_shots` | `LeagueDashPtDefend`, three calls per season: `defense_category` = "Overall", "3 Pointers", "Less Than 6Ft" | player x season x category | CLOSE_DEF_PERSON_ID, GP, FREQ, D_FGM, D_FGA, D_FG_PCT, NORMAL_FG_PCT, PCT_PLUSMINUS, plus a `category` column |
| `raw.player_hustle` | `LeagueHustleStatsPlayer` | player x season | MIN, CONTESTED_SHOTS (2pt and 3pt), DEFLECTIONS, CHARGES_DRAWN, LOOSE_BALLS_RECOVERED, DEF_BOXOUTS |
| `raw.team_defense_misc` | `LeagueDashTeamStats` with measure type "Misc" | team x season | OPP_PTS_OFF_TOV, OPP_PTS_2ND_CHANCE, OPP_PTS_FB, OPP_PTS_PAINT |

- Every table: `season`, `season_type`, `loaded_at`. Upsert on the natural key, the same way the extras tables do it.
- DDL goes in a new `sql/007_raw_defense.sql`. Apply it to Supabase.
- Add flags to `load.py`:
  - `--defense`: current season. Add it to the nightly step in `.github/workflows/refresh.yml` next to `--extras`.
  - `--defense-backfill`: 2024-25 and 2025-26 only. On/off and tracking data are big, and the free tier is 500 MB.
- Sleep about 1 second between the 30 team calls.
- Print row counts per table at the end.

## 2. dbt

- Add staging models for each raw table, with sources in `_sources.yml` and tests (not_null, unique on the grain) in `_staging.yml`.
- `marts/mart_player_defense.sql`: one row per player x team x season, regular season only.
  - `on_min`, `on_drtg`, `off_drtg`, and `onoff_drtg = off_drtg - on_drtg`. Positive means the team defends better with him on the court.
  - `dfga_overall` and `dfg_diff_overall = D_FG_PCT - NORMAL_FG_PCT`. Negative is good.
  - The same pair for the rim ("Less Than 6Ft") and for threes.
  - Contests, deflections, charges and loose balls per 36, using hustle minutes.
  - Salary, joined the way `mart_player_value` does it.
  - `is_qualified`: on_min >= 500 and games >= 20.
  - For qualified players only, league percentiles of `onoff_drtg`, `dfg_diff_overall` (inverted, so higher is better), contests per 36 and deflections per 36.
- `marts/mart_team_defense_misc.sql`: per game values plus league rank for each OPP_PTS_* column (rank 1 = fewest allowed).
- Run `dbt build`. Everything must pass.

## 3. Web

- **`web/sql/defense.sql`:**
  - Join `mart_player_defense` into the `roster` CTE.
  - Add a `misc` object for the team, holding the four OPP_PTS values with ranks and the league averages.
  - Keep the output shape backward compatible and add fields only. Update `DefenseData` in `web/lib/types.ts`.
- **`web/app/defense/page.tsx`:**
  - Replace the two `Placeholder` cards with:
    - **Defensive impact table.** Players sorted by `onoff_drtg`, with a diverging bar (`Diverging` in `components/charts/html.tsx`), defended FG% against expected, rim and three-point splits, contests and deflections per 36, and salary.
    - **"Where they score on us" strip.** Four tiles: points off turnovers, second chance, fast break and paint, each per game with a league rank. Accent colour for the top 5, warn for the bottom 10.
  - Headline rule: one sentence an exec can act on, generated from the data in `web/lib/insights.ts`. Example: "Alex Caruso is worth 7.2 points per 100 on defense. Opponents shoot 5.1 points worse when he guards them."
  - Show the qualifier in the caption ("500+ minutes, 20+ games") and add one honest line: on/off depends on teammates, so treat it as a signal.
- **`web/sql/player.sql` and `web/app/player/page.tsx`:**
  - Add a defense card under the clutch block: on/off, defended FG% against expected, rim FG% against expected, and the percentiles.
  - If the player is not qualified, show "Not enough minutes to rank yet."
- **Demo data:** regenerate `web/data/demo/defense.json` and `web/data/demo/player.json` (OKC, 2025-26) from the live queries, so demo mode shows the new sections.
- **Cache:** bump the cache key in `web/lib/db.ts` (`page-query-v3` to `v4`).

## 4. Check

- `pytest`: add tests for the new parsing and upserts in `tests/`.
- `npx tsc --noEmit`, `npx eslint .`, then `DATA_MODE=demo npm run build`.
- Run locally against Supabase and open `/defense` for OKC, then pick one opponent from the filter. Open `/player` for Shai Gilgeous-Alexander.
- Copy rules: no em dashes anywhere in UI text, plain words, no jargon. Spell out what a stat means the first time it appears in a caption.
- Commit in logical steps (load, dbt, web) and push.

When done, report:
- row counts per new table
- `dbt build` result
- the top 5 OKC players by `onoff_drtg` with their defended FG% difference
