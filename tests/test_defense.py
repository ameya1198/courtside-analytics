"""Offline tests for the defense loaders (phase 2): parsing and the delete-then-insert load."""
import pandas as pd

from ingestion import load, nba_client
from ingestion.load import DEFENDED_COLUMNS, ON_OFF_COLUMNS, prepare_defense


def on_off_row(player_id: int, status: str, drtg: float) -> dict:
    # Shaped like a TeamPlayerOnOffSummary row: the player is in VS_PLAYER_ID, ranks and extras are dropped
    return {"GROUP_SET": "On/Off Court", "TEAM_ID": 1610612760, "TEAM_ABBREVIATION": "OKC", "TEAM_NAME": "Thunder",
            "VS_PLAYER_ID": player_id, "VS_PLAYER_NAME": "Caruso, Alex", "COURT_STATUS": status, "GP": 60,
            "MIN": 1500.0, "PLUS_MINUS": 9.1, "OFF_RATING": 117.0, "DEF_RATING": drtg, "NET_RATING": 117.0 - drtg}


def test_stack_on_off_keeps_each_rows_own_status():
    # The API sends the off-court table first, against its own dataset names. Labels must come from the rows.
    off_first = [pd.DataFrame([on_off_row(1, "Off", 109.5)]), pd.DataFrame([on_off_row(1, "On", 103.0)])]
    df = nba_client.stack_on_off(off_first)
    assert dict(zip(df["COURT_STATUS"], df["DEF_RATING"])) == {"off": 109.5, "on": 103.0}
    assert nba_client.stack_on_off([pd.DataFrame(), pd.DataFrame()]).empty


def test_prepare_defense_renames_player_and_team_columns():
    on_off = prepare_defense(nba_client.stack_on_off([pd.DataFrame([on_off_row(1627936, "On", 103.0)])]),
                             ON_OFF_COLUMNS, 2025, "Regular Season")
    assert list(on_off.columns) == ON_OFF_COLUMNS + ["season", "season_type"]
    assert on_off["player_id"].iloc[0] == 1627936 and str(on_off["player_id"].dtype) == "Int64"
    assert on_off["court_status"].iloc[0] == "on"

    defended = pd.DataFrame([{
        "CLOSE_DEF_PERSON_ID": 1627936, "PLAYER_NAME": "Alex Caruso", "PLAYER_LAST_TEAM_ID": 1610612760,
        "PLAYER_LAST_TEAM_ABBREVIATION": "OKC", "PLAYER_POSITION": "G", "AGE": 31.0, "GP": 60, "G": 60, "FREQ": 1.0,
        "D_FGM": 300, "D_FGA": 700, "D_FG_PCT": 0.429, "NORMAL_FG_PCT": 0.471, "PCT_PLUSMINUS": -0.042,
        "CATEGORY": "Overall",
    }])
    df = prepare_defense(defended, DEFENDED_COLUMNS, 2025, "Regular Season")
    assert df["player_id"].iloc[0] == 1627936 and df["team_abbreviation"].iloc[0] == "OKC"
    assert df["pct_plusminus"].iloc[0] == -0.042 and "age" not in df.columns


def test_load_combined_drops_repeats_and_replaces_the_season(monkeypatch):
    calls = {}
    monkeypatch.setattr(load, "start_run", lambda *a: 1)
    monkeypatch.setattr(load, "finish_run", lambda *a, **k: calls.setdefault("status", a[2]))

    def fake_replace(engine, table, df, where, params):
        calls.update(table=table, rows=len(df), where=where, params=params)

    monkeypatch.setattr(load, "replace_rows", fake_replace)
    same_row_twice = pd.DataFrame([on_off_row(1, "on", 103.0), on_off_row(1, "on", 103.0), on_off_row(1, "off", 109.0)])
    n = load.load_combined(None, "player_on_off", [same_row_twice, pd.DataFrame()], ON_OFF_COLUMNS,
                           ["team_id", "player_id", "court_status"], 2025, "Regular Season")
    assert n == 2 and calls["rows"] == 2                    # the repeat is dropped on the natural key
    assert calls["where"] == "season = :s and season_type = :t"
    assert calls["params"] == {"s": 2025, "t": "Regular Season"}
    assert calls["status"] == "success"


def test_load_combined_skips_when_the_api_has_nothing(monkeypatch):
    monkeypatch.setattr(load, "start_run", lambda *a: 1)
    monkeypatch.setattr(load, "finish_run", lambda *a, **k: None)
    monkeypatch.setattr(load, "replace_rows", lambda *a: (_ for _ in ()).throw(AssertionError("should not write")))
    assert load.load_combined(None, "player_on_off", [pd.DataFrame()], ON_OFF_COLUMNS,
                              ["team_id", "player_id", "court_status"], 2026, "Playoffs") == 0
