"""Offline tests for the Basketball-Reference advanced-stats parser (Win Shares, VORP)."""
from ingestion import salaries

# Shaped like the real team page: the table sits inside an HTML comment, with a repeated header row
# and a team total row that has no player link.
TEAM_PAGE = """
<div id="all_advanced"><!--
<table id="advanced"><thead><tr><th data-stat="ranker">Rk</th><th data-stat="name_display">Player</th></tr></thead>
<tbody>
<tr><th data-stat="ranker">1</th>
<td data-stat="name_display"><a href="/players/g/gilgesh01.html">Shai Gilgeous-Alexander</a></td>
<td data-stat="age">27</td><td data-stat="games">68</td><td data-stat="mp">2259</td>
<td data-stat="ows">11.1</td><td data-stat="dws">4.1</td><td data-stat="ws">15.2</td><td data-stat="ws_per_48">.323</td>
<td data-stat="obpm">8.7</td><td data-stat="dbpm">3.0</td>
<td data-stat="bpm">11.7</td><td data-stat="vorp">7.8</td></tr>
<tr class="thead"><th data-stat="ranker">Rk</th><th data-stat="name_display">Player</th></tr>
<tr><th data-stat="ranker">2</th>
<td data-stat="name_display"><a href="/players/d/dieng01.html">Ousmane Dieng</a></td>
<td data-stat="age">22</td><td data-stat="games">4</td><td data-stat="mp">20</td>
<td data-stat="ows">-0.1</td><td data-stat="dws">0.0</td>
<td data-stat="ws">-0.1</td><td data-stat="ws_per_48">-.240</td>
<td data-stat="obpm">-9.1</td><td data-stat="dbpm">-1.0</td>
<td data-stat="bpm">-10.1</td><td data-stat="vorp">-0.1</td></tr>
<tr><td data-stat="name_display">Team Totals</td><td data-stat="ws">68.0</td></tr>
</tbody></table>
--></div>
"""


def test_parse_team_advanced_reads_win_shares_and_vorp():
    rows = salaries.parse_team_advanced(TEAM_PAGE)
    assert [r["bbref_id"] for r in rows] == ["gilgesh01", "dieng01"]   # header repeat and team totals skipped
    sga = rows[0]
    assert (sga["ows"], sga["dws"], sga["ws"], sga["vorp"]) == (11.1, 4.1, 15.2, 7.8)
    assert sga["ws_per_48"] == 0.323 and sga["minutes"] == 2259 and sga["games"] == 68
    assert rows[1]["ws"] == -0.1 and rows[1]["ws_per_48"] == -0.24        # negatives and leading dots parse


def test_parse_number_handles_blanks_and_text():
    assert salaries.parse_number("") is None
    assert salaries.parse_number("—") is None
    assert salaries.parse_number(".5") == 0.5


def test_page_without_advanced_table_gives_no_rows():
    assert salaries.parse_team_advanced("<html><table id='roster'></table></html>") == []
