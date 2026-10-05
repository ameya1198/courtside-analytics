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

export function teamColor(abbr: string) {
  return TEAM_COLORS[abbr]?.primary ?? BRAND;
}

export const logoUrl = (teamId: number) => `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`;
export const headshotUrl = (playerId: number) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
