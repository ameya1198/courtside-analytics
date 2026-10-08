"""Offline tests for the current-roster loader (Roster Needs page)."""
import pandas as pd
import pytest

from ingestion import load
from ingestion.load import ROSTER_COLUMNS, prepare_roster


def roster_row(player_id: int, name: str) -> dict:
    # Shaped like a CommonTeamRoster row
    return {"TeamID": 1610612744, "SEASON": "2026", "LeagueID": "00", "PLAYER": name, "NICKNAME": name.split()[0],
            "PLAYER_SLUG": "x", "NUM": "30", "POSITION": "G", "HEIGHT": "6-2", "WEIGHT": "185",
            "BIRTH_DATE": "MAR 14, 1988", "AGE": 38.0, "EXP": "17", "SCHOOL": "Davidson", "PLAYER_ID": player_id}


def test_prepare_roster_renames_and_tags_the_team():
    df = prepare_roster(pd.DataFrame([roster_row(201939, "Stephen Curry")]), "GSW", 2026)
    assert list(df.columns) == ["season"] + ROSTER_COLUMNS
    row = df.iloc[0]
    assert (row["player_id"], row["team_abbreviation"], row["season"], row["experience"]) == (201939, "GSW", 2026, "17")
    assert prepare_roster(pd.DataFrame(), "GSW", 2026).empty


def test_load_rosters_refuses_a_partial_league(monkeypatch):
    # If some teams fail to return, writing would turn their players into "free agents"
    monkeypatch.setattr(load, "start_run", lambda *a: 1)
    monkeypatch.setattr(load, "finish_run", lambda *a, **k: None)
    monkeypatch.setattr(load.time, "sleep", lambda s: None)
    monkeypatch.setattr(load.nba_client, "get_teams", lambda: pd.DataFrame([{"id": 1610612744, "abbreviation": "GSW"}]))
    one_player = pd.DataFrame([roster_row(1, "A B")])
    monkeypatch.setattr(load.nba_client, "get_team_roster", lambda team_id, season: one_player)
    monkeypatch.setattr(load, "replace_rows", lambda *a: (_ for _ in ()).throw(AssertionError("should not write")))
    with pytest.raises(RuntimeError, match="only 1 teams"):
        load.load_rosters(None, 2026)


def test_preseason_never_joins_the_regular_season_sources():
    # load_season loops over GAME_LOG_SOURCES, so preseason must stay out of it
    assert "preseason_game_logs" not in load.GAME_LOG_SOURCES
    assert load.PRESEASON_SOURCE["level"] == "P"
