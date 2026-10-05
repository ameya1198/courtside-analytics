"""Offline tests for the clutch, bio, schedule and salary loaders."""
import pandas as pd
import requests

from ingestion import salaries
from ingestion.load import BIO_COLUMNS, TEAM_CLUTCH_COLUMNS, prepare_rows, prepare_schedule

TEAM_PAGE = """
<div id="all_salaries2"><!--
<table id="salaries2"><thead><tr><th>Rk</th><th></th><th>Salary</th></tr></thead>
<tbody>
<tr><th data-stat="ranker">1</th><td data-stat="player"><a href="/players/g/gilgesh01.html">Shai Gilgeous-Alexander</a></td>
<td data-stat="salary">$38,333,050</td></tr>
<tr><th data-stat="ranker">2</th><td data-stat="player"><a href="/players/h/holmgch01.html">Chet Holmgren</a></td>
<td data-stat="salary">$13,731,368</td></tr>
</tbody></table>
--></div>
"""

CONTRACTS_PAGE = """
<table id="player-contracts">
<thead>
<tr class="over_header"><th colspan="3"></th><th colspan="3">Salary</th></tr>
<tr><th>Rk</th><th>Player</th><th>Tm</th><th>2026-27</th><th>2027-28</th><th>2028-29</th></tr>
</thead>
<tbody>
<tr><th>1</th><td><a href="/players/c/curryst01.html">Stephen Curry</a></td><td><a href="/teams/GSW/2027.html">GSW</a></td>
<td>$62,587,158</td><td></td><td></td></tr>
<tr class="thead"><th>Rk</th><th>Player</th><th>Tm</th><th>2026-27</th><th>2027-28</th><th>2028-29</th></tr>
<tr><th>2</th><td><a href="/players/j/jokicni01.html">Nikola Jokić</a></td><td>DEN</td>
<td>$59,033,114</td><td>$62,841,702</td><td></td></tr>
</tbody></table>
"""


def test_team_page_salaries_are_found_inside_comments():
    rows = salaries.parse_team_salaries(TEAM_PAGE)
    assert rows == [
        {"bbref_id": "gilgesh01", "player_name": "Shai Gilgeous-Alexander", "salary": 38333050},
        {"bbref_id": "holmgch01", "player_name": "Chet Holmgren", "salary": 13731368},
    ]


def test_contracts_page_gives_one_row_per_player_season():
    rows = salaries.parse_contracts(CONTRACTS_PAGE)
    assert {(r["bbref_id"], r["season"], r["salary"]) for r in rows} == {
        ("curryst01", 2026, 62587158), ("jokicni01", 2026, 59033114), ("jokicni01", 2027, 62841702),
    }
    assert all(r["team"] in ("GSW", "DEN") for r in rows)


def test_names_match_across_accents_and_suffixes():
    assert salaries.normalize_name("Nikola Jokić") == salaries.normalize_name("Nikola Jokic")
    assert salaries.normalize_name("Gary Trent Jr.") == "gary trent"
    assert salaries.normalize_name("Shai Gilgeous-Alexander") == "shai gilgeous alexander"
    index = salaries.build_name_index([
        {"id": 1, "full_name": "Nikola Jokić", "is_active": True},
        {"id": 2, "full_name": "John Smith", "is_active": True},
        {"id": 3, "full_name": "John Smith", "is_active": True},
        {"id": 4, "full_name": "Old Player", "is_active": False},
    ])
    assert salaries.match_player("Nikola Jokic", index) == 1
    assert salaries.match_player("John Smith", index) is None   # two active players share it
    assert salaries.match_player("Old Player", index) == 4
    # Same player, different spelling on the two sites
    assert salaries.match_player("Mohamed Bamba", {}) == 1628964
    assert salaries.match_player("Egor Dёmin", {}) == 1642856


def test_fetch_reads_pages_as_utf8(monkeypatch):
    # No charset in the header: requests alone would decode this as Latin-1 ("JokiÄ")
    response = requests.Response()
    response.status_code = 200
    response.headers["Content-Type"] = "text/html"
    response._content = "<td>Nikola Jokić</td>".encode()
    monkeypatch.setattr(salaries.requests, "get", lambda *a, **k: response)
    monkeypatch.setattr(salaries.time, "sleep", lambda s: None)
    assert "Jokić" in salaries.fetch("https://example.test/page.html")


def test_bbref_team_codes_and_urls():
    assert salaries.bbref_team("BKN") == "BRK"
    assert salaries.team_page_url("PHX", 2025).endswith("/teams/PHO/2026.html")


def test_clutch_and_bio_rows():
    clutch = pd.DataFrame([{n.upper(): 3.0 for n in TEAM_CLUTCH_COLUMNS} | {"TEAM_NAME": "Thunder", "W_RANK": 1}])
    df = prepare_rows(clutch, TEAM_CLUTCH_COLUMNS, 2025, "Regular Season")
    assert "w_rank" not in df.columns and str(df["w"].dtype) == "Int64"
    bio = pd.DataFrame([{n.upper(): "x" for n in BIO_COLUMNS} | {"PLAYER_ID": 1, "AGE": 27.0,
                                                                  "PLAYER_WEIGHT": "", "PLAYER_HEIGHT_INCHES": 78}])
    df = prepare_rows(bio, BIO_COLUMNS, 2025, "Regular Season")
    assert pd.isna(df["player_weight"].iloc[0])           # blank weight becomes empty, not an error
    assert df["age"].iloc[0] == 27.0


def test_schedule_keeps_scores_only_for_finished_games():
    raw = pd.DataFrame([
        {"gameId": "0022600001", "gameDateEst": "2026-10-20T00:00:00Z", "gameDateTimeUTC": "2026-10-20T23:30:00Z",
         "gameStatus": 1, "gameStatusText": "7:30 pm ET", "gameLabel": "", "homeTeam_teamId": 1610612760,
         "homeTeam_teamTricode": "OKC", "homeTeam_score": 0, "awayTeam_teamId": 1610612745,
         "awayTeam_teamTricode": "HOU", "awayTeam_score": 0, "arenaName": "Paycom Center"},
        {"gameId": "0012600001", "gameDateEst": "2026-10-04T00:00:00Z", "gameDateTimeUTC": "2026-10-04T23:00:00Z",
         "gameStatus": 3, "gameStatusText": "Final", "gameLabel": "Preseason", "homeTeam_teamId": 1610612759,
         "homeTeam_teamTricode": "SAS", "homeTeam_score": 110, "awayTeam_teamId": 1610612752,
         "awayTeam_teamTricode": "NYK", "awayTeam_score": 104, "arenaName": "Frost Bank Center"},
    ])
    df = prepare_schedule(raw, 2026)
    assert len(df) == 2
    assert pd.isna(df.loc[df["game_id"] == "0022600001", "home_score"].iloc[0])
    assert df.loc[df["game_id"] == "0012600001", "home_score"].iloc[0] == 110
    assert str(df["game_date"].iloc[0]) == "2026-10-20"
