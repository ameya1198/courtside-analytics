"""Small tests that run without internet or a database."""
import pandas as pd

from ingestion.load import PLAYER_LOG_COLUMNS, prepare_game_logs
from ingestion.nba_client import get_players, get_teams, season_label


def fake_api_response() -> pd.DataFrame:
    """One fake row shaped like the NBA API's player game log (uppercase names, decimals)."""
    row = {name.upper(): 1.0 for name in PLAYER_LOG_COLUMNS}
    row.update({"GAME_DATE": "2025-10-21", "PLAYER_NAME": "Test Player", "WL": "W",
                "SEASON_ID": "22025", "GAME_ID": "0022500001", "MATCHUP": "OKC vs. HOU",
                "TEAM_ABBREVIATION": "OKC", "TEAM_NAME": "Thunder", "EXTRA_COLUMN": 99})
    return pd.DataFrame([row])


def test_season_label():
    assert season_label(2025) == "2025-26"
    assert season_label(2099) == "2099-00"


def test_prepare_keeps_only_table_columns_and_adds_ours():
    df = prepare_game_logs(fake_api_response(), PLAYER_LOG_COLUMNS, 2025, "Regular Season")
    assert "extra_column" not in df.columns          # unknown columns are dropped
    assert df["season"].iloc[0] == 2025
    assert df["season_type"].iloc[0] == "Regular Season"
    assert str(df["pts"].dtype) == "Int64"           # decimals became whole numbers
    assert df["game_date"].iloc[0].year == 2025       # text became a real date


def test_static_lists():
    assert len(get_teams()) == 30
    assert get_players()["full_name"].str.len().min() > 0
