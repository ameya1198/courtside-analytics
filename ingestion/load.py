"""Loads NBA data into the raw schema in Supabase.

Usage:
    python -m ingestion.load --reference            # teams and players
    python -m ingestion.load --season 2025          # one season (2025 = 2025-26)
    python -m ingestion.load --current              # this season only (the nightly job)
    python -m ingestion.load --backfill             # every season since BACKFILL_START_SEASON

Every load is safe to re-run. It deletes that season's rows first, then inserts
fresh ones, all in one transaction, so you never end up with duplicates.
"""
import argparse
import os
import time
from datetime import date

import pandas as pd
from sqlalchemy import text

from ingestion import nba_client
from ingestion.db import get_engine

SEASON_TYPES = ["Regular Season", "Playoffs"]

# The columns each raw table expects. Anything else the API returns is dropped.
STAT_COLUMNS = [
    "min", "fgm", "fga", "fg_pct", "fg3m", "fg3a", "fg3_pct", "ftm", "fta", "ft_pct",
    "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf", "pts", "plus_minus",
]
PLAYER_LOG_COLUMNS = (
    ["season_id", "player_id", "player_name", "team_id", "team_abbreviation", "team_name",
     "game_id", "game_date", "matchup", "wl"]
    + STAT_COLUMNS + ["fantasy_pts", "video_available"]
)
TEAM_LOG_COLUMNS = (
    ["season_id", "team_id", "team_abbreviation", "team_name",
     "game_id", "game_date", "matchup", "wl"]
    + STAT_COLUMNS + ["video_available"]
)

# These columns are whole numbers in the database. Pandas reads them as decimals,
# so we convert them before inserting.
WHOLE_NUMBER_COLUMNS = [
    "player_id", "team_id", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
    "reb", "ast", "stl", "blk", "tov", "pf", "pts", "video_available",
]

# Which table, which columns, and which API level ("P" player, "T" team) per source.
GAME_LOG_SOURCES = {
    "player_game_logs": {"columns": PLAYER_LOG_COLUMNS, "level": "P"},
    "team_game_logs": {"columns": TEAM_LOG_COLUMNS, "level": "T"},
}


def current_season() -> int:
    """The NBA season starts in October. Before October we are still in last year's season."""
    today = date.today()
    return today.year if today.month >= 10 else today.year - 1


def prepare_game_logs(
    df: pd.DataFrame, columns: list, season: int, season_type: str
) -> pd.DataFrame:
    """Turn the API response into rows that match the raw table."""
    df = df.copy()
    df.columns = [name.lower() for name in df.columns]  # SEASON_ID -> season_id
    df = df[columns]  # keep only the columns we store
    df["game_date"] = pd.to_datetime(df["game_date"]).dt.date
    for name in WHOLE_NUMBER_COLUMNS:
        if name in df.columns:
            df[name] = pd.to_numeric(df[name]).astype("Int64")  # Int64 allows blanks
    df["season"] = season
    df["season_type"] = season_type
    return df


# ---- Run log: one row in raw.ingestion_log per load ----

def start_run(engine, source: str, season: int | None) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text("insert into raw.ingestion_log (source, season) values (:source, :season) "
                 "returning run_id"),
            {"source": source, "season": str(season) if season else None},
        ).scalar_one()


def finish_run(engine, run_id: int, status: str, rows: int = 0, error: str | None = None):
    with engine.begin() as conn:
        conn.execute(
            text("update raw.ingestion_log set finished_at = now(), status = :status, "
                 "rows_loaded = :rows, error_message = :error where run_id = :run_id"),
            {"status": status, "rows": rows, "error": error, "run_id": run_id},
        )


# ---- Loaders ----

def load_game_logs(engine, source: str, season: int, season_type: str) -> int:
    """Load one season of one kind of game log. Returns the number of rows loaded."""
    config = GAME_LOG_SOURCES[source]
    run_id = start_run(engine, f"{source}:{season_type}", season)
    try:
        raw = nba_client.get_game_logs(season, season_type, config["level"])
        if raw.empty:
            # No games yet (new season, or no playoffs yet). Keep what we have.
            finish_run(engine, run_id, "success", rows=0)
            print(f"{source} {season} {season_type}: no rows from the API, skipped")
            return 0

        df = prepare_game_logs(raw, config["columns"], season, season_type)
        with engine.begin() as conn:  # one transaction: both steps work, or neither does
            conn.execute(
                text(f"delete from raw.{source} where season = :s and season_type = :t"),
                {"s": season, "t": season_type},
            )
            df.to_sql(source, conn, schema="raw", if_exists="append", index=False,
                      chunksize=2000, method="multi")
        finish_run(engine, run_id, "success", rows=len(df))
        print(f"{source} {season} {season_type}: loaded {len(df)} rows")
        return len(df)
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise


def load_reference(engine) -> None:
    """Teams and players are small lists, so we replace them completely each time."""
    tables = {
        "teams": (nba_client.get_teams(),
                  ["id", "full_name", "abbreviation", "nickname", "city", "state", "year_founded"]),
        "players": (nba_client.get_players(),
                    ["id", "full_name", "first_name", "last_name", "is_active"]),
    }
    for table, (df, columns) in tables.items():
        run_id = start_run(engine, table, None)
        try:
            with engine.begin() as conn:
                conn.execute(text(f"delete from raw.{table}"))
                df[columns].to_sql(table, conn, schema="raw", if_exists="append",
                                   index=False, chunksize=2000, method="multi")
            finish_run(engine, run_id, "success", rows=len(df))
            print(f"{table}: loaded {len(df)} rows")
        except Exception as error:
            finish_run(engine, run_id, "failed", error=str(error)[:500])
            raise


def load_season(engine, season: int) -> None:
    """Everything for one season: player and team logs, regular season and playoffs."""
    for source in GAME_LOG_SOURCES:
        for season_type in SEASON_TYPES:
            load_game_logs(engine, source, season, season_type)
            time.sleep(2)  # be polite to the NBA servers


def main() -> None:
    parser = argparse.ArgumentParser(description="Load NBA data into Supabase")
    parser.add_argument("--reference", action="store_true", help="load teams and players")
    parser.add_argument("--season", type=int, help="start year, e.g. 2025 for 2025-26")
    parser.add_argument("--current", action="store_true", help="load the current season")
    parser.add_argument("--backfill", action="store_true", help="load all seasons")
    args = parser.parse_args()

    engine = get_engine()
    if args.reference:
        load_reference(engine)
    if args.season:
        load_season(engine, args.season)
    if args.current:
        load_season(engine, current_season())
    if args.backfill:
        first = int(os.environ.get("BACKFILL_START_SEASON", "2015"))
        for season in range(first, current_season() + 1):
            load_season(engine, season)


if __name__ == "__main__":
    main()
