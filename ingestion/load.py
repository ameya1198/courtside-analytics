"""Loads NBA data into the raw schema in Supabase.

Usage:
    python -m ingestion.load --reference            # teams and players
    python -m ingestion.load --season 2025          # one season (2025 = 2025-26)
    python -m ingestion.load --current              # this season only (the nightly job)
    python -m ingestion.load --backfill             # every season since BACKFILL_START_SEASON
    python -m ingestion.load --shots                # new shots this season (the nightly job)
    python -m ingestion.load --shots-backfill       # all shots since SHOTS_START_SEASON

Every load is safe to re-run. It deletes that season's rows first, then inserts
fresh ones, all in one transaction, so you never end up with duplicates.
"""
import argparse
import os
import time
from datetime import date, timedelta

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

# Shot columns we keep. Names and a few extras (HTM, VTM) are dropped to save space.
SHOT_COLUMNS = [
    "game_id", "game_event_id", "player_id", "team_id", "period", "minutes_remaining",
    "seconds_remaining", "event_type", "action_type", "shot_type", "shot_zone_basic",
    "shot_zone_area", "shot_zone_range", "shot_distance", "loc_x", "loc_y",
    "shot_made_flag", "game_date",
]

# These columns are whole numbers in the database. Pandas reads them as decimals,
# so we convert them before inserting.
WHOLE_NUMBER_COLUMNS = [
    "player_id", "team_id", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
    "reb", "ast", "stl", "blk", "tov", "pf", "pts", "video_available",
    "game_event_id", "period", "minutes_remaining", "seconds_remaining", "shot_distance",
    "loc_x", "loc_y", "shot_made_flag",
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


def prepare_rows(
    df: pd.DataFrame, columns: list, season: int, season_type: str
) -> pd.DataFrame:
    """Turn an API response (game logs or shots) into rows that match the raw table."""
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

        df = prepare_rows(raw, config["columns"], season, season_type)
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


def season_dates(season: int) -> tuple[date, date]:
    """Rough first and last day of a season: October 1 to July 15 of the next year."""
    return date(season, 10, 1), date(season + 1, 7, 15)


def date_windows(start: date, end: date, days: int = 30):
    """Split a date range into chunks, so each shot request stays small."""
    while start <= end:
        window_end = min(start + timedelta(days=days - 1), end)
        yield start, window_end
        start = window_end + timedelta(days=1)


def load_shots_window(engine, season: int, season_type: str, date_from: date, date_to: date) -> int:
    """Load the shots between two dates. Safe to re-run: it deletes that date range first."""
    run_id = start_run(engine, f"shots:{season_type}", season)
    try:
        raw = nba_client.get_shots(season, season_type, date_from, date_to)
        if raw.empty:
            finish_run(engine, run_id, "success", rows=0)
            print(f"shots {season} {season_type} {date_from} to {date_to}: no shots, skipped")
            return 0

        df = prepare_rows(raw, SHOT_COLUMNS, season, season_type)
        # A shot is identified by game + event number. Drop repeats just in case.
        df = df.drop_duplicates(subset=["game_id", "game_event_id"])
        with engine.begin() as conn:
            conn.execute(
                text("delete from raw.shots where season = :s and season_type = :t "
                     "and game_date between :d1 and :d2"),
                {"s": season, "t": season_type, "d1": date_from, "d2": date_to},
            )
            df.to_sql("shots", conn, schema="raw", if_exists="append", index=False,
                      chunksize=2000, method="multi")
        finish_run(engine, run_id, "success", rows=len(df))
        print(f"shots {season} {season_type} {date_from} to {date_to}: loaded {len(df)} rows")
        return len(df)
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise


def load_shots_range(engine, season: int, start: date, end: date) -> None:
    """Load shots for both season types between two dates, one window at a time."""
    for window_start, window_end in date_windows(start, end):
        for season_type in SEASON_TYPES:
            load_shots_window(engine, season, season_type, window_start, window_end)
            time.sleep(2)  # be polite to the NBA servers


def load_shots_season(engine, season: int) -> None:
    """A whole season of shots (used for the one-time backfill)."""
    first, last = season_dates(season)
    load_shots_range(engine, season, first, min(last, date.today()))


def load_shots_recent(engine, season: int) -> None:
    """The nightly job: only reload shots from 3 days before our newest shot.

    The 3 day overlap picks up late stat corrections without re-downloading the season.
    """
    with engine.connect() as conn:
        newest = conn.execute(
            text("select max(game_date) from raw.shots where season = :s"), {"s": season}
        ).scalar_one()
    first, last = season_dates(season)
    start = newest - timedelta(days=3) if newest else first
    end = min(last, date.today())
    if start <= end:
        load_shots_range(engine, season, start, end)


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
    parser.add_argument("--shots", action="store_true", help="load new shots for this season")
    parser.add_argument("--shots-backfill", action="store_true", help="load all shots")
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
    if args.shots:
        load_shots_recent(engine, current_season())
    if args.shots_backfill:
        # Shots are big, so we keep fewer seasons than game logs (free tier is 500 MB)
        first = int(os.environ.get("SHOTS_START_SEASON", "2024"))
        for season in range(first, current_season() + 1):
            load_shots_season(engine, season)


if __name__ == "__main__":
    main()
