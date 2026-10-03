// Headlines are written from the data on every request, so they change as games are played.
// Each one is a single sentence that points at something a decision maker can act on.
import { ordinal, pct, signed } from "./format";
import type { Factors, PlayerData, RestData, TeamData, TeamGame, Zone } from "./types";

const ZONE_NAMES: Record<string, string> = {
  "Above the Break 3": "Above-the-break threes",
  "Restricted Area": "Shots at the rim",
  "In The Paint (Non-RA)": "Paint shots outside the restricted area",
  "Mid-Range": "Mid-range shots",
  "Left Corner 3": "Left-corner threes",
  "Right Corner 3": "Right-corner threes",
};
export const zoneName = (z: string) => ZONE_NAMES[z] ?? z;

export const FACTOR_META: { key: keyof Factors; label: string; short: string; hint: string; lowerIsBetter?: boolean }[] = [
  { key: "efg", label: "Shooting (eFG%)", short: "shooting", hint: "Shot value after counting threes" },
  { key: "tov", label: "Turnovers (TOV%)", short: "ball security", hint: "Lower is better", lowerIsBetter: true },
  { key: "orb", label: "Rebounding (ORB%)", short: "offensive rebounding", hint: "Share of own misses recovered" },
  { key: "ftr", label: "Free throws (FT rate)", short: "getting to the line", hint: "Free throws made per shot" },
];

/** Rolling average of the last `n` margins, starting at game n. */
export function rolling(games: TeamGame[], n = 10) {
  const out: { game: number; value: number; date: string }[] = [];
  for (let i = n - 1; i < games.length; i++) {
    const slice = games.slice(i - n + 1, i + 1);
    const v = slice.reduce((a, g) => a + g.margin, 0) / n;
    out.push({ game: i + 1, value: Math.round(v * 10) / 10, date: games[i].game_date });
  }
  return out;
}

export function rollingHeadline(abbr: string, series: ReturnType<typeof rolling>) {
  if (series.length < 5) return `Not enough games yet for a 10-game trend. Check back after game 15.`;
  const low = series.reduce((a, b) => (b.value < a.value ? b : a));
  const high = series.reduce((a, b) => (b.value > a.value ? b : a));
  const last = series[series.length - 1];
  if (last.game === low.game) return `${abbr}'s 10-game margin is at its season low (${signed(low.value)}). Act on this stretch now.`;
  if (last.value - low.value >= 4)
    return `${abbr}'s 10-game margin fell to ${signed(low.value)} by game ${low.game} before recovering to ${signed(last.value)}. Review that stretch.`;
  if (high.value - last.value >= 4)
    return `${abbr}'s 10-game margin has slipped from ${signed(high.value)} in game ${high.game} to ${signed(last.value)}. Find what changed.`;
  return `${abbr}'s 10-game margin has held between ${signed(low.value)} and ${signed(high.value)} all season.`;
}

export function factorsHeadline(f: NonNullable<TeamData["factors"]>) {
  const ranks = FACTOR_META.map((m) => ({ m, rank: f[`${m.key}_rank` as keyof typeof f] as number }));
  const worst = ranks.reduce((a, b) => (b.rank > a.rank ? b : a));
  const best = ranks.reduce((a, b) => (b.rank < a.rank ? b : a));
  if (worst.rank >= 21) return `${cap(worst.m.short)} is the gap to fix: ${ordinal(worst.rank)} of 30.`;
  if (best.rank <= 5) return `${cap(best.m.short)} is the edge to protect: ${ordinal(best.rank)} of 30.`;
  return `No factor is a weakness: every one ranks between ${ordinal(best.rank)} and ${ordinal(worst.rank)}.`;
}

export function splits(games: TeamGame[]) {
  const agg = (list: TeamGame[]) => ({
    games: list.length,
    wins: list.filter((g) => g.win).length,
    margin: list.length ? list.reduce((a, g) => a + g.margin, 0) / list.length : 0,
  });
  const rested = games.filter((g) => g.days_rest !== null && !g.b2b);
  return {
    home: agg(games.filter((g) => g.home)),
    away: agg(games.filter((g) => !g.home)),
    b2b: agg(games.filter((g) => g.b2b)),
    rested: agg(rested),
  };
}

export function splitsHeadline(s: ReturnType<typeof splits>) {
  const b2bGap = s.rested.margin - s.b2b.margin;
  const roadGap = s.home.margin - s.away.margin;
  if (s.b2b.games >= 4 && b2bGap >= 5 && b2bGap >= roadGap)
    return `Back-to-backs are the risk: ${signed(s.b2b.margin)} margin, against ${signed(s.rested.margin)} when rested.`;
  if (s.away.games >= 4 && roadGap >= 5)
    return `Road games are the risk: ${signed(s.away.margin)} margin away, against ${signed(s.home.margin)} at home.`;
  return `No situation drags results down: home, road and rest margins sit within 5 points.`;
}

export function zonesHeadline(team: Zone[], league: Zone[]) {
  const lg = new Map(league.map((z) => [z.zone, z]));
  const diffs = team
    .filter((z) => z.share >= 0.04 && lg.has(z.zone))
    .map((z) => ({ z, diff: z.fg - lg.get(z.zone)!.fg }));
  if (!diffs.length) return "Shot locations will show here once shots are loaded.";
  const best = diffs.reduce((a, b) => (b.diff > a.diff ? b : a));
  const worst = diffs.reduce((a, b) => (b.diff < a.diff ? b : a));
  if (best.diff >= 0.02)
    return `Keep leaning on ${zoneName(best.z.zone).toLowerCase()}: ${pct(best.z.fg)} made, ${(best.diff * 100).toFixed(1)} points above the league.`;
  return `Fix ${zoneName(worst.z.zone).toLowerCase()}: ${pct(worst.z.fg)} made against ${pct(lg.get(worst.z.zone)!.fg)} league-wide.`;
}

const PCT_LABELS: Record<string, string> = { pts: "scoring", reb: "rebounding", ast: "playmaking", stl: "steals", blk: "rim protection", ts: "efficiency", fg3: "three-point shooting" };

export function percentileHeadline(p: NonNullable<PlayerData["percentiles"]>) {
  const entries = Object.entries(p).filter(([k]) => k in PCT_LABELS) as [string, number][];
  const top = entries.filter(([, v]) => v >= 90).sort((a, b) => b[1] - a[1]);
  const low = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (top.length >= 2) return `Elite at ${PCT_LABELS[top[0][0]]} and ${PCT_LABELS[top[1][0]]}. ${cap(PCT_LABELS[low[0]])} is the weakest area (${ordinal(low[1])} percentile).`;
  if (top.length === 1) return `Elite at ${PCT_LABELS[top[0][0]]}. ${cap(PCT_LABELS[low[0]])} is the weakest area (${ordinal(low[1])} percentile).`;
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return `Best at ${PCT_LABELS[best[0]]} (${ordinal(best[1])} percentile). ${cap(PCT_LABELS[low[0]])} is the weakest area.`;
}

export function formHeadline(games: PlayerData["lastGames"], seasonPpg: number) {
  if (!games.length) return "No games played yet this season.";
  const w = games.filter((g) => g.win).length;
  const avg = games.reduce((a, g) => a + g.pts, 0) / games.length;
  const best = games.reduce((a, b) => (b.pts > a.pts ? b : a));
  const trend = avg - seasonPpg >= 2 ? "running hot" : seasonPpg - avg >= 2 ? "cooling off" : "steady";
  return `${w}-${games.length - w} in the last ${games.length}, ${trend} at ${avg.toFixed(1)} points, with ${best.pts} against ${best.opp}.`;
}

export function restHeadlines(d: RestData) {
  const b2b = d.buckets.find((b) => b.rest === 0);
  const gaps = d.gaps
    .filter((g) => g.b2b_pct !== null && g.rested_pct !== null && g.b2b_games >= 8)
    .map((g) => ({ ...g, gap: (g.rested_pct! - g.b2b_pct!) * 100 }))
    .sort((a, b) => b.gap - a.gap);
  const most = gaps[0], least = gaps[gaps.length - 1];
  return {
    b2b,
    gaps,
    gapTitle:
      most && least
        ? `${most.abbr} wins ${Math.round(most.gap)} points less often on the second night. ${least.abbr} ${least.gap < 0 ? `wins ${Math.round(-least.gap)} more` : "barely changes"}.`
        : "Back-to-back records will show once teams have played some.",
  };
}

export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
