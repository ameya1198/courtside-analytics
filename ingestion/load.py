"""Loads NBA data into the raw schema in Supabase.

Usage:
    python -m ingestion.load --reference            # teams and players
    python -m ingestion.load --season 2025          # one season (2025 = 2025-26)
    python -m ingestion.load --current              # this season only (the nightly job)
    python -m ingestion.load --backfill             # every season since BACKFILL_START_SEASON
    python -m ingestion.load --shots                # new shots this season (the nightly job)
    python -m ingestion.load --shots-backfill       # all shots since SHOTS_START_SEASON
    python -m ingestion.load --extras               # clutch, player bio and schedule for this season (nightly)
    python -m ingestion.load --extras-backfill      # clutch and bio for every season since BACKFILL_START_SEASON
    python -m ingestion.load --salaries             # salaries, Win Shares and VORP from Basketball-Reference
    python -m ingestion.load --defense              # player and team defense for this season (nightly)
    python -m ingestion.load --defense-backfill     # the same since DEFENSE_START_SEASON (default 2024)

Every load is safe to re-run. It deletes that season's rows first, then inserts
fresh ones, all in one transaction, so you never end up with duplicates.
"""
import argparse
import os
import time
from datetime import date, timedelta

import pandas as pd
from sqlalchemy import text

from ingestion import nba_client, salaries
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

# Clutch and bio columns we keep (the API also returns ranks and other columns we drop).
CLUTCH_STAT_COLUMNS = [
    "gp", "w", "l", "min", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta",
]
TEAM_CLUTCH_COLUMNS = (["team_id", "team_name"] + CLUTCH_STAT_COLUMNS
                       + ["oreb", "dreb", "reb", "ast", "tov", "stl", "blk", "pts", "plus_minus"])
PLAYER_CLUTCH_COLUMNS = (["player_id", "player_name", "team_id", "team_abbreviation"] + CLUTCH_STAT_COLUMNS
                         + ["reb", "ast", "tov", "stl", "blk", "pts", "plus_minus"])
BIO_COLUMNS = [
    "player_id", "player_name", "team_id", "team_abbreviation", "age", "player_height_inches",
    "player_weight", "college", "country", "draft_year", "draft_round", "draft_number",
]
# The schedule API uses camelCase names. Ours on the left, theirs on the right.
SCHEDULE_COLUMNS = {
    "game_id": "gameId",
    "game_date": "gameDateEst",
    "game_datetime_utc": "gameDateTimeUTC",
    "game_status": "gameStatus",
    "game_status_text": "gameStatusText",
    "game_label": "gameLabel",
    "home_team_id": "homeTeam_teamId",
    "home_team_tricode": "homeTeam_teamTricode",
    "home_score": "homeTeam_score",
    "away_team_id": "awayTeam_teamId",
    "away_team_tricode": "awayTeam_teamTricode",
    "away_score": "awayTeam_score",
    "arena_name": "arenaName",
}

# Defense (phase 2). Some endpoints name the player and team columns differently, so we rename first.
DEFENSE_RENAMES = {
    "vs_player_id": "player_id", "vs_player_name": "player_name",           # on/off
    "close_def_person_id": "player_id",                                      # defended shots
    "player_last_team_id": "team_id", "player_last_team_abbreviation": "team_abbreviation",
}
ON_OFF_COLUMNS = [
    "team_id", "team_abbreviation", "player_id", "player_name", "court_status",
    "gp", "min", "plus_minus", "off_rating", "def_rating", "net_rating",
]
DEFENDED_COLUMNS = [
    "player_id", "player_name", "team_id", "team_abbreviation", "player_position", "gp", "freq",
    "d_fgm", "d_fga", "d_fg_pct", "normal_fg_pct", "pct_plusminus", "category",
]
HUSTLE_COLUMNS = [
    "player_id", "player_name", "team_id", "team_abbreviation", "g", "min", "contested_shots",
    "contested_shots_2pt", "contested_shots_3pt", "deflections", "charges_drawn",
    "loose_balls_recovered", "def_loose_balls_recovered", "def_boxouts",
]
TEAM_MISC_COLUMNS = [
    "team_id", "team_name", "gp", "opp_pts_off_tov", "opp_pts_2nd_chance", "opp_pts_fb", "opp_pts_paint",
]
DEFENSE_TABLES = ["player_on_off", "player_defended_shots", "player_hustle", "team_defense_misc"]

# These columns are whole numbers in the database. Pandas reads them as decimals,
# so we convert them before inserting.
WHOLE_NUMBER_COLUMNS = [
    "player_id", "team_id", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
    "reb", "ast", "stl", "blk", "tov", "pf", "pts", "video_available",
    "game_event_id", "period", "minutes_remaining", "seconds_remaining", "shot_distance",
    "loc_x", "loc_y", "shot_made_flag", "gp", "w", "l", "player_height_inches", "player_weight", "g",
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
    if "game_date" in df.columns:
        df["game_date"] = pd.to_datetime(df["game_date"]).dt.date
    for name in WHOLE_NUMBER_COLUMNS:
        if name in df.columns:
            # errors="coerce" turns blanks and odd text into empty values instead of failing
            df[name] = pd.to_numeric(df[name], errors="coerce").round().astype("Int64")
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

# Preseason player logs go to their own table and are not in GAME_LOG_SOURCES, so load_season never mixes
# them into the regular-season data. Only Player Profile's "Preseason so far" box reads them.
PRESEASON_SOURCE = {"columns": PLAYER_LOG_COLUMNS, "level": "P"}


def load_game_logs(engine, source: str, season: int, season_type: str) -> int:
    """Load one season of one kind of game log. Returns the number of rows loaded."""
    config = PRESEASON_SOURCE if source == "preseason_game_logs" else GAME_LOG_SOURCES[source]
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


def replace_rows(engine, table: str, df: pd.DataFrame, where: str, params: dict) -> None:
    """Delete the rows a load covers, then insert the new ones, in one transaction."""
    with engine.begin() as conn:
        conn.execute(text(f"delete from raw.{table} where {where}"), params)
        if not df.empty:
            df.to_sql(table, conn, schema="raw", if_exists="append", index=False,
                      chunksize=2000, method="multi")


def load_season_table(engine, table: str, fetch, columns: list, season: int, season_type: str) -> int:
    """Load one season of a league-wide table (clutch or bio). Skips quietly if there is no data yet."""
    run_id = start_run(engine, f"{table}:{season_type}", season)
    try:
        raw = fetch(season, season_type)
        if raw.empty:
            finish_run(engine, run_id, "success", rows=0)
            print(f"{table} {season} {season_type}: no rows from the API, skipped")
            return 0
        df = prepare_rows(raw, columns, season, season_type)
        replace_rows(engine, table, df, "season = :s and season_type = :t", {"s": season, "t": season_type})
        finish_run(engine, run_id, "success", rows=len(df))
        print(f"{table} {season} {season_type}: loaded {len(df)} rows")
        return len(df)
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise


def load_clutch(engine, season: int) -> None:
    for season_type in SEASON_TYPES:
        load_season_table(engine, "team_clutch", nba_client.get_team_clutch, TEAM_CLUTCH_COLUMNS, season, season_type)
        time.sleep(2)
        load_season_table(engine, "player_clutch", nba_client.get_player_clutch, PLAYER_CLUTCH_COLUMNS,
                          season, season_type)
        time.sleep(2)


def load_bio(engine, season: int) -> None:
    """Age is per season, so one regular-season call per season is enough."""
    load_season_table(engine, "player_bio", nba_client.get_player_bio, BIO_COLUMNS, season, "Regular Season")
    time.sleep(2)


def prepare_schedule(raw: pd.DataFrame, season: int) -> pd.DataFrame:
    """Rename the schedule API's columns to ours. Scores of games not played yet are left empty."""
    df = pd.DataFrame({ours: raw[theirs] if theirs in raw.columns else None
                       for ours, theirs in SCHEDULE_COLUMNS.items()})
    df["game_date"] = pd.to_datetime(df["game_date"]).dt.date
    df["game_datetime_utc"] = pd.to_datetime(df["game_datetime_utc"], utc=True)
    for name in ["game_status", "home_team_id", "away_team_id", "home_score", "away_score"]:
        df[name] = pd.to_numeric(df[name], errors="coerce").astype("Int64")
    not_final = df["game_status"] != 3
    df.loc[not_final, ["home_score", "away_score"]] = pd.NA
    df = df[df["game_id"].notna() & df["home_team_id"].notna()].drop_duplicates(subset=["game_id"])
    df["season"] = season
    return df


def load_schedule(engine, season: int) -> int:
    run_id = start_run(engine, "schedule", season)
    try:
        df = prepare_schedule(nba_client.get_schedule(season), season)
        replace_rows(engine, "schedule", df, "season = :s", {"s": season})
        finish_run(engine, run_id, "success", rows=len(df))
        print(f"schedule {season}: loaded {len(df)} games")
        return len(df)
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise


def load_extras(engine, season: int) -> None:
    load_clutch(engine, season)
    load_bio(engine, season)
    load_schedule(engine, season)


def prepare_defense(raw: pd.DataFrame, columns: list, season: int, season_type: str) -> pd.DataFrame:
    """Like prepare_rows, but first renames the endpoint's player and team columns to ours."""
    df = raw.copy()
    df.columns = [name.lower() for name in df.columns]
    df = df.rename(columns=DEFENSE_RENAMES)
    return prepare_rows(df, columns, season, season_type)


def load_combined(engine, table: str, frames, columns: list, key: list, season: int, season_type: str) -> int:
    """Load a table built from several API calls (one per team, or one per shot category)."""
    run_id = start_run(engine, f"{table}:{season_type}", season)
    try:
        frames = [f for f in frames if not f.empty]
        if not frames:
            finish_run(engine, run_id, "success", rows=0)
            print(f"{table} {season} {season_type}: no rows from the API, skipped")
            return 0
        df = prepare_defense(pd.concat(frames, ignore_index=True), columns, season, season_type)
        df = df.drop_duplicates(subset=key)  # the natural key, so a re-sent row is not stored twice
        replace_rows(engine, table, df, "season = :s and season_type = :t", {"s": season, "t": season_type})
        finish_run(engine, run_id, "success", rows=len(df))
        print(f"{table} {season} {season_type}: loaded {len(df)} rows")
        return len(df)
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise


def team_on_off_frames(season: int, season_type: str):
    """One on/off call per team, with a short pause so we do not hammer the NBA servers."""
    for team_id in nba_client.get_teams()["id"]:
        yield nba_client.get_player_on_off(int(team_id), season, season_type)
        time.sleep(1)


def load_defense(engine, season: int) -> None:
    """On/off, defended shots, hustle and team misc for one season, regular season and playoffs."""
    for season_type in SEASON_TYPES:
        load_combined(engine, "player_on_off", list(team_on_off_frames(season, season_type)), ON_OFF_COLUMNS,
                      ["team_id", "player_id", "court_status"], season, season_type)
        defended = []
        for category in nba_client.DEFENSE_CATEGORIES:
            defended.append(nba_client.get_player_defended_shots(season, season_type, category))
            time.sleep(2)
        load_combined(engine, "player_defended_shots", defended, DEFENDED_COLUMNS,
                      ["player_id", "category"], season, season_type)
        load_season_table(engine, "player_hustle", nba_client.get_player_hustle, HUSTLE_COLUMNS, season, season_type)
        time.sleep(2)
        load_season_table(engine, "team_defense_misc", nba_client.get_team_defense_misc, TEAM_MISC_COLUMNS,
                          season, season_type)
        time.sleep(2)


def print_defense_counts(engine) -> None:
    """Row counts per defense table, split by season, after a load."""
    with engine.connect() as conn:
        for table in DEFENSE_TABLES:
            rows = conn.execute(text(f"select season, season_type, count(*) from raw.{table} "
                                     "group by 1, 2 order by 1, 2")).all()
            total = sum(r[2] for r in rows)
            detail = ", ".join(f"{r[0]} {r[1]}: {r[2]}" for r in rows) or "empty"
            print(f"raw.{table}: {total} rows ({detail})")


ROSTER_COLUMNS = ["team_id", "team_abbreviation", "player_id", "player_name", "position", "age", "experience"]


def prepare_roster(df: pd.DataFrame, team_abbreviation: str, season: int) -> pd.DataFrame:
    """One team's CommonTeamRoster rows, renamed to match raw.team_rosters."""
    if df.empty:
        return pd.DataFrame(columns=["season"] + ROSTER_COLUMNS)
    out = df.rename(columns={"TeamID": "team_id", "PLAYER_ID": "player_id", "PLAYER": "player_name",
                             "POSITION": "position", "AGE": "age", "EXP": "experience"})
    out["team_abbreviation"] = team_abbreviation
    out["season"] = season
    out["age"] = pd.to_numeric(out["age"], errors="coerce")
    return out[["season"] + ROSTER_COLUMNS]


def load_rosters(engine, season: int) -> None:
    """Every team's current roster. Replaces the season's rows, so a re-run reflects today's trades and signings."""
    run_id = start_run(engine, "team_rosters", season)
    try:
        frames = []
        for team in nba_client.get_teams().itertuples():
            frames.append(prepare_roster(nba_client.get_team_roster(team.id, season), team.abbreviation, season))
            time.sleep(1)  # 30 calls, one per team
        df = pd.concat(frames, ignore_index=True).drop_duplicates(["team_id", "player_id"])
        # A partial load would make healthy players look like free agents, so refuse to write one
        if df["team_id"].nunique() < 30:
            raise RuntimeError(f"only {df['team_id'].nunique()} teams returned a roster")
        replace_rows(engine, "team_rosters", df, "season = :s", {"s": season})
        finish_run(engine, run_id, "success", len(df))
        print(f"raw.team_rosters: {len(df)} players on {df['team_id'].nunique()} teams for {season}")
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise


def load_salaries(engine, first_season: int, last_season: int) -> None:
    """Past and current seasons from team pages, then this and future seasons from the contracts page.

    The team pages also carry the Advanced table (Win Shares, BPM, VORP), so we save that from the
    same download into raw.player_advanced.
    """
    index = salaries.build_name_index(nba_client.get_players().to_dict("records"))
    unmatched: set[str] = set()

    def with_ids(rows: list[dict]) -> pd.DataFrame:
        df = pd.DataFrame(rows)
        if df.empty:
            return df
        df["player_id"] = [salaries.match_player(n, index) for n in df["player_name"]]
        df["player_id"] = df["player_id"].astype("Int64")
        unmatched.update(df.loc[df["player_id"].isna(), "player_name"])
        return df

    for season in range(first_season, last_season + 1):
        run_id = start_run(engine, "salaries:team_page", season)
        adv_run = start_run(engine, "player_advanced:team_page", season)
        try:
            rows, advanced = [], []
            for team in salaries.NBA_TEAMS:
                html = salaries.fetch(salaries.team_page_url(team, season))  # one download, two tables
                code = salaries.bbref_team(team)
                for row in salaries.parse_team_salaries(html):
                    rows.append({**row, "team": code, "season": season})
                for row in salaries.parse_team_advanced(html):
                    advanced.append({**row, "team": code, "season": season})
            df = with_ids(rows)
            if not df.empty:
                df["source"] = "team_page"
            replace_rows(engine, "salaries", df, "season = :s and source = 'team_page'", {"s": season})
            finish_run(engine, run_id, "success", rows=len(df))
            print(f"salaries {season} (team pages): loaded {len(df)} rows")

            adv = with_ids(advanced)
            if not adv.empty:
                adv["games"] = adv["games"].round().astype("Int64")
            replace_rows(engine, "player_advanced", adv, "season = :s", {"s": season})
            finish_run(engine, adv_run, "success", rows=len(adv))
            print(f"player_advanced {season} (team pages): loaded {len(adv)} rows")
        except Exception as error:
            finish_run(engine, run_id, "failed", error=str(error)[:500])
            finish_run(engine, adv_run, "failed", error=str(error)[:500])
            raise

    run_id = start_run(engine, "salaries:contracts_page", None)
    try:
        df = with_ids(salaries.parse_contracts(salaries.fetch(salaries.CONTRACTS_URL)))
        if not df.empty:
            df["source"] = "contracts_page"
        replace_rows(engine, "salaries", df, "source = 'contracts_page'", {})
        finish_run(engine, run_id, "success", rows=len(df))
        print(f"salaries (contracts page): loaded {len(df)} rows")
    except Exception as error:
        finish_run(engine, run_id, "failed", error=str(error)[:500])
        raise

    if unmatched:
        print(f"{len(unmatched)} salary names did not match an NBA player id. "
              f"Add them to NAME_OVERRIDES in ingestion/salaries.py if they matter:")
        for name in sorted(unmatched):
            print(f"  {name}  ->  key '{salaries.normalize_name(name)}'")


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


def load_preseason(engine, season: int) -> None:
    """This season's preseason player logs. Reloaded whole each run; empty outside October is fine."""
    load_game_logs(engine, "preseason_game_logs", season, "Pre Season")


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
    parser.add_argument("--extras", action="store_true", help="clutch, bio and schedule for this season")
    parser.add_argument("--extras-backfill", action="store_true", help="clutch and bio for all seasons")
    parser.add_argument("--salaries", action="store_true", help="salaries and advanced stats from Basketball-Reference")
    parser.add_argument("--defense", action="store_true", help="player and team defense for this season")
    parser.add_argument("--preseason", action="store_true", help="this season's preseason player logs")
    parser.add_argument("--rosters", action="store_true", help="every team's current roster")
    parser.add_argument("--defense-backfill", action="store_true", help="the defense tables since DEFENSE_START_SEASON")
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
        first = int(os.environ.get("SHOTS_START_SEASON", "2022"))
        for season in range(first, current_season() + 1):
            load_shots_season(engine, season)
    if args.extras:
        load_extras(engine, current_season())
    if args.extras_backfill:
        first = int(os.environ.get("BACKFILL_START_SEASON", "2015"))
        for season in range(first, current_season() + 1):
            load_clutch(engine, season)
            load_bio(engine, season)
        # The schedule only matters for last season and this one.
        for season in (current_season() - 1, current_season()):
            load_schedule(engine, season)
    if args.salaries:
        first = int(os.environ.get("SALARY_START_SEASON", "2023"))
        load_salaries(engine, first, current_season())
    if args.defense:
        load_defense(engine, current_season())
        print_defense_counts(engine)
    if args.preseason:
        load_preseason(engine, current_season())
    if args.rosters:
        load_rosters(engine, current_season())
    if args.defense_backfill:
        # On/off and tracking data add up, so only 2024-25 onward (free tier is 500 MB)
        first = int(os.environ.get("DEFENSE_START_SEASON", "2024"))
        for season in range(first, current_season() + 1):
            load_defense(engine, season)
        print_defense_counts(engine)


if __name__ == "__main__":
    main()
