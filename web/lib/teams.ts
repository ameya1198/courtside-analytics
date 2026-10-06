// Team colours. The dashboard takes its highlight colour from the team on screen.
// "warn" is the contrast colour for weak spots: orange, unless the team colour is already warm.

type TeamColor = { primary: string; secondary: string };

export const TEAM_COLORS: Record<string, TeamColor> = {
  ATL: { primary: "#E03A3E", secondary: "#26282A" },
  BOS: { primary: "#007A33", secondary: "#BA9653" },
  BKN: { primary: "#000000", secondary: "#707070" },
  CHA: { primary: "#1D1160", secondary: "#00788C" },
  CHI: { primary: "#CE1141", secondary: "#000000" },
  CLE: { primary: "#860038", secondary: "#FDBB30" },
  DAL: { primary: "#00538C", secondary: "#B8C4CA" },
  DEN: { primary: "#0E2240", secondary: "#FEC524" },
  DET: { primary: "#C8102E", secondary: "#1D42BA" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C" },
  HOU: { primary: "#CE1141", secondary: "#000000" },
  IND: { primary: "#002D62", secondary: "#FDBB30" },
  LAC: { primary: "#C8102E", secondary: "#1D428A" },
  LAL: { primary: "#552583", secondary: "#FDB927" },
  MEM: { primary: "#5D76A9", secondary: "#12173F" },
  MIA: { primary: "#98002E", secondary: "#F9A01B" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6" },
  MIN: { primary: "#0C2340", secondary: "#236192" },
  NOP: { primary: "#0C2340", secondary: "#C8102E" },
  NYK: { primary: "#006BB6", secondary: "#F58426" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4" },
  PHI: { primary: "#006BB6", secondary: "#ED174C" },
  PHX: { primary: "#1D1160", secondary: "#E56020" },
  POR: { primary: "#E03A3E", secondary: "#000000" },
  SAC: { primary: "#5A2D81", secondary: "#63727A" },
  SAS: { primary: "#000000", secondary: "#C4CED4" },
  TOR: { primary: "#CE1141", secondary: "#000000" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B" },
  WAS: { primary: "#002B5C", secondary: "#E31837" },
};

export const BRAND = "#1F4FD1";
const ORANGE = "#D9480F";
const INK = "#0B0D12";
const PLAIN_PANEL = { "--panel": "transparent", "--panel-ink": "#0B0D12", "--panel-muted": "#444B58", "--panel-grid": "#E2E5EA", "--panel-dot": "#A3A9B3" };

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hue(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return -1;
  const d = max - min;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Text colour that reads on top of a fill. */
export function onColor(hex: string) {
  return luminance(hex) > 0.4 ? INK : "#FFFFFF";
}

/** The CSS variables a page sets for its team. Very dark team colours fall back to the brand blue for charts. */
export function teamTheme(abbr?: string | null) {
  const c = (abbr && TEAM_COLORS[abbr]) || { primary: BRAND, secondary: INK };
  const tooDark = luminance(c.primary) < 0.012;
  const sec = luminance(c.secondary);
  // Charts sit on both white and near-black panels, so the accent needs a mid-tone.
  const accent = tooDark ? (sec > 0.05 && sec < 0.45 ? c.secondary : "#5F6B78") : c.primary;
  const h = hue(accent);
  const warm = h >= 0 && (h < 45 || h > 330);
  return {
    "--hero": c.primary,
    "--hero-ink": onColor(c.primary),
    "--accent": accent,
    "--accent-ink": onColor(accent),
    "--warn": warm ? INK : ORANGE,
    "--warn-ink": "#FFFFFF",
    // Charts sit straight on the page background, no panel behind them.
    ...PLAIN_PANEL,
  } as React.CSSProperties;
}

// Straight-line distance between two colours in RGB, 0 to about 441
export function colorDistance(x: string, y: string) {
  const [a, b] = [hexToRgb(x), hexToRgb(y)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * The opponent's colour on the Matchup page, chosen to sit next to our accent.
 * Tries their primary, then secondary: it has to show up on white and look clearly different from ours.
 * Falls back to ink when neither colour works.
 */
export function opponentColor(ours: string, theirs: string) {
  const accent = teamTheme(ours)["--accent" as keyof React.CSSProperties] as string;
  const c = TEAM_COLORS[theirs];
  if (!c) return INK;
  const usable = (hex: string) => luminance(hex) < 0.45 && colorDistance(hex, accent) > 110;
  return [c.primary, c.secondary].find(usable) ?? INK;
}

export function teamColor(abbr: string) {
  return TEAM_COLORS[abbr]?.primary ?? BRAND;
}

export const logoUrl = (teamId: number) => `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`;
export const headshotUrl = (playerId: number) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;

// All 30 teams, for the team picker. Ids are the NBA's own, which the logo images use.
export const TEAMS = [
  { abbr: "ATL", id: 1610612737, city: "Atlanta", name: "Hawks", conf: "East" },
  { abbr: "BOS", id: 1610612738, city: "Boston", name: "Celtics", conf: "East" },
  { abbr: "BKN", id: 1610612751, city: "Brooklyn", name: "Nets", conf: "East" },
  { abbr: "CHA", id: 1610612766, city: "Charlotte", name: "Hornets", conf: "East" },
  { abbr: "CHI", id: 1610612741, city: "Chicago", name: "Bulls", conf: "East" },
  { abbr: "CLE", id: 1610612739, city: "Cleveland", name: "Cavaliers", conf: "East" },
  { abbr: "DET", id: 1610612765, city: "Detroit", name: "Pistons", conf: "East" },
  { abbr: "IND", id: 1610612754, city: "Indiana", name: "Pacers", conf: "East" },
  { abbr: "MIA", id: 1610612748, city: "Miami", name: "Heat", conf: "East" },
  { abbr: "MIL", id: 1610612749, city: "Milwaukee", name: "Bucks", conf: "East" },
  { abbr: "NYK", id: 1610612752, city: "New York", name: "Knicks", conf: "East" },
  { abbr: "ORL", id: 1610612753, city: "Orlando", name: "Magic", conf: "East" },
  { abbr: "PHI", id: 1610612755, city: "Philadelphia", name: "76ers", conf: "East" },
  { abbr: "TOR", id: 1610612761, city: "Toronto", name: "Raptors", conf: "East" },
  { abbr: "WAS", id: 1610612764, city: "Washington", name: "Wizards", conf: "East" },
  { abbr: "DAL", id: 1610612742, city: "Dallas", name: "Mavericks", conf: "West" },
  { abbr: "DEN", id: 1610612743, city: "Denver", name: "Nuggets", conf: "West" },
  { abbr: "GSW", id: 1610612744, city: "Golden State", name: "Warriors", conf: "West" },
  { abbr: "HOU", id: 1610612745, city: "Houston", name: "Rockets", conf: "West" },
  { abbr: "LAC", id: 1610612746, city: "Los Angeles", name: "Clippers", conf: "West" },
  { abbr: "LAL", id: 1610612747, city: "Los Angeles", name: "Lakers", conf: "West" },
  { abbr: "MEM", id: 1610612763, city: "Memphis", name: "Grizzlies", conf: "West" },
  { abbr: "MIN", id: 1610612750, city: "Minnesota", name: "Timberwolves", conf: "West" },
  { abbr: "NOP", id: 1610612740, city: "New Orleans", name: "Pelicans", conf: "West" },
  { abbr: "OKC", id: 1610612760, city: "Oklahoma City", name: "Thunder", conf: "West" },
  { abbr: "PHX", id: 1610612756, city: "Phoenix", name: "Suns", conf: "West" },
  { abbr: "POR", id: 1610612757, city: "Portland", name: "Trail Blazers", conf: "West" },
  { abbr: "SAC", id: 1610612758, city: "Sacramento", name: "Kings", conf: "West" },
  { abbr: "SAS", id: 1610612759, city: "San Antonio", name: "Spurs", conf: "West" },
  { abbr: "UTA", id: 1610612762, city: "Utah", name: "Jazz", conf: "West" },
] as const;

export const teamInfo = (abbr: string | null | undefined) => TEAMS.find((t) => t.abbr === abbr);
