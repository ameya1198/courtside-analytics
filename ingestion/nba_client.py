"""Thin wrapper around nba_api. Every function returns a pandas DataFrame."""
import time

import pandas as pd
from nba_api.stats.endpoints import leaguegamelog
from nba_api.stats.static import players, teams


def season_label(start_year: int) -> str:
    """The NBA API wants '2025-26', but we store the start year (2025)."""
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def get_teams() -> pd.DataFrame:
    """The 30 teams. Comes from a list inside the package, so no web call."""
    return pd.DataFrame(teams.get_teams())


def get_players() -> pd.DataFrame:
    """Every player in NBA history. Also a built-in list, no web call."""
    return pd.DataFrame(players.get_players())


def get_game_logs(start_year: int, season_type: str, level: str) -> pd.DataFrame:
    """One call returns a whole season of game logs.

    level "P" gives one row per player per game.
    level "T" gives one row per team per game.
    season_type is "Regular Season" or "Playoffs".
    """
    last_error = None
    for attempt in range(3):  # stats.nba.com is flaky, so try up to 3 times
        try:
            endpoint = leaguegamelog.LeagueGameLog(
                season=season_label(start_year),
                season_type_all_star=season_type,
                player_or_team_abbreviation=level,
                timeout=60,
            )
            return endpoint.get_data_frames()[0]
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(5 * (attempt + 1))  # wait a little longer each time
    raise last_error
