"""Player salaries from Basketball-Reference.

nba_api has no salary data, so we read two kinds of Basketball-Reference pages:
  - each team's season page, which lists what every player on the roster was paid that season
  - the league contracts page, which lists this season's and future seasons' salaries

Basketball-Reference asks for no more than 20 requests a minute, so we wait between calls.
Players are matched to NBA player ids by name. Names that do not match are reported so they can
be added to NAME_OVERRIDES below.
"""
import re
import time
import unicodedata

import requests
from bs4 import BeautifulSoup

BASE = "https://www.basketball-reference.com"
HEADERS = {"User-Agent": "CourtsideAnalytics/1.0 (portfolio project; github.com/ameya1198/courtside-analytics)"}
PAUSE_SECONDS = 4  # 15 requests a minute, under the site's limit of 20

# Basketball-Reference uses a few different team codes from the NBA.
BBREF_TEAM = {"BKN": "BRK", "CHA": "CHO", "PHX": "PHO"}
NBA_TEAMS = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW", "HOU", "IND", "LAC", "LAL", "MEM",
    "MIA", "MIL", "MIN", "NOP", "NYK", "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]

# Basketball-Reference name (after normalize_name) -> NBA player id, for names that differ between the sites.
NAME_OVERRIDES: dict[str, int] = {}

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def bbref_team(nba_tricode: str) -> str:
    return BBREF_TEAM.get(nba_tricode, nba_tricode)


def normalize_name(name: str) -> str:
    """'Nikola Jokić' and 'Nikola Jokic' should match, as should 'Gary Trent Jr.' and 'Gary Trent'."""
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    text = re.sub(r"[.'’`]", "", text.lower())
    text = re.sub(r"[-‐]", " ", text)
    words = [w for w in text.split() if w not in SUFFIXES]
    return " ".join(words)


def parse_money(text: str) -> int | None:
    digits = re.sub(r"[^0-9]", "", text or "")
    return int(digits) if digits else None


def season_start(label: str) -> int | None:
    """'2026-27' -> 2026."""
    match = re.match(r"^(\d{4})-\d{2}$", label.strip())
    return int(match.group(1)) if match else None


def fetch(url: str) -> str:
    """Download a page politely. Waits and retries once if the site says we are going too fast."""
    for attempt in range(3):
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 429:
            time.sleep(60 * (attempt + 1))
            continue
        response.raise_for_status()
        time.sleep(PAUSE_SECONDS)
        return response.text
    raise RuntimeError(f"Basketball-Reference kept refusing {url}")


def _soup(html: str) -> BeautifulSoup:
    # Many Basketball-Reference tables sit inside HTML comments. Removing the markers exposes them.
    return BeautifulSoup(html.replace("<!--", "").replace("-->", ""), "html.parser")


def _player_cell(row):
    link = row.find("a", href=re.compile(r"^/players/[a-z]/[a-z0-9]+\.html"))
    if not link:
        return None, None
    bbref_id = re.search(r"/players/[a-z]/([a-z0-9]+)\.html", link["href"]).group(1)
    return bbref_id, link.get_text(strip=True)


def parse_team_salaries(html: str) -> list[dict]:
    """Rows of the 'Salaries' table on a team season page."""
    soup = _soup(html)
    table = soup.find("table", id="salaries2") or soup.find("table", id=re.compile("salar"))
    if table is None:
        return []
    rows = []
    for row in table.select("tbody tr"):
        bbref_id, name = _player_cell(row)
        if not bbref_id:
            continue
        cell = row.find(attrs={"data-stat": "salary"})
        if cell is None:  # fall back to the last cell that looks like money
            cells = [c for c in row.find_all("td") if "$" in c.get_text()]
            cell = cells[-1] if cells else None
        salary = parse_money(cell.get_text()) if cell else None
        if salary:
            rows.append({"bbref_id": bbref_id, "player_name": name, "salary": salary})
    return rows


def parse_contracts(html: str) -> list[dict]:
    """Rows of the league contracts table: one row per player per season listed."""
    soup = _soup(html)
    table = soup.find("table", id="player-contracts") or soup.find("table")
    if table is None:
        return []
    header_rows = table.select("thead tr")
    # The last header row has one label per column: Rk, Player, Tm, 2026-27, 2027-28, ...
    labels = [c.get_text(strip=True) for c in header_rows[-1].find_all(["th", "td"])] if header_rows else []
    season_cols = {i: season_start(label) for i, label in enumerate(labels) if season_start(label)}
    team_col = next((i for i, label in enumerate(labels) if label in ("Tm", "Team")), None)
    rows = []
    for row in table.select("tbody tr"):
        if "thead" in (row.get("class") or []):
            continue  # repeated header rows inside the body
        bbref_id, name = _player_cell(row)
        if not bbref_id:
            continue
        cells = row.find_all(["th", "td"])
        team = cells[team_col].get_text(strip=True) if team_col is not None and team_col < len(cells) else None
        for i, season in season_cols.items():
            if i < len(cells):
                salary = parse_money(cells[i].get_text())
                if salary:
                    rows.append({"bbref_id": bbref_id, "player_name": name, "team": team,
                                 "season": season, "salary": salary})
    return rows


def build_name_index(players) -> dict[str, int]:
    """Map normalized names to NBA ids. Active players win ties; names shared by two active players are left out."""
    index: dict[str, int] = {}
    active_seen: dict[str, int] = {}
    for p in sorted(players, key=lambda p: p["is_active"]):  # inactive first, so active overwrite
        key = normalize_name(p["full_name"])
        if p["is_active"]:
            active_seen[key] = active_seen.get(key, 0) + 1
        index[key] = p["id"]
    for key, count in active_seen.items():
        if count > 1:
            index.pop(key, None)
    return index


def match_player(name: str, index: dict[str, int]) -> int | None:
    key = normalize_name(name)
    return NAME_OVERRIDES.get(key) or index.get(key)


def team_page_url(nba_tricode: str, season: int) -> str:
    # Basketball-Reference names seasons by their end year: 2025-26 is /2026.html
    return f"{BASE}/teams/{bbref_team(nba_tricode)}/{season + 1}.html"


CONTRACTS_URL = f"{BASE}/contracts/players.html"
