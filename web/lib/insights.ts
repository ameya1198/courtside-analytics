// Headlines are written from the data on every request, so they change as games are played.
// Each one is a single sentence that points at something a decision maker can act on.
import { ordinal, pct, signed } from "./format";
import type { Clutch, DefenseData, DefenseMisc, DefensePlayer, Factors, PlayerData, RestData, TeamData, TeamGame, Zone } from "./types";

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

export function clutchHeadline(abbr: string, c: Clutch) {
  const record = `${c.w}-${c.l}`;
  if (c.games < 5) return `${abbr} has played only ${c.games} clutch games. Too few to judge yet.`;
  if (c.net_rank <= 5) return `Close games are an edge: ${record} in clutch time, ${ordinal(c.net_rank)}-best net rating.`;
  if (c.net_rank > c.teams - 5) return `Close games are costing wins: ${record} in clutch time, ${ordinal(c.net_rank)} of ${c.teams} on net rating. Review late-game sets.`;
  return `${record} in clutch time, ${ordinal(c.net_rank)} of ${c.teams} on net rating. No late-game problem to fix.`;
}

export const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

// ---------- Defense ----------

export const DEF_FACTOR_META: { key: keyof DefenseData["leagueFactors"]; label: string; short: string; hint: string }[] = [
  { key: "opp_efg", label: "Opponent shooting", short: "contesting shots", hint: "Opponent eFG%. Lower is better" },
  { key: "forced_tov", label: "Turnovers forced", short: "forcing turnovers", hint: "Opponent TOV%. Higher is better" },
  { key: "dreb", label: "Defensive rebounding", short: "finishing possessions", hint: "Share of opponent misses kept" },
  { key: "opp_ftr", label: "Fouling", short: "staying out of foul trouble", hint: "Opponent FT rate. Lower is better" },
];

export function defFactorsHeadline(f: NonNullable<DefenseData["factors"]>) {
  const ranks = DEF_FACTOR_META.map((m) => ({ m, rank: f[`${m.key}_rank` as keyof typeof f] as number }));
  const worst = ranks.reduce((a, b) => (b.rank > a.rank ? b : a));
  const best = ranks.reduce((a, b) => (b.rank < a.rank ? b : a));
  if (worst.rank >= 21) return `${cap(best.m.short)} is the strength (${ordinal(best.rank)}). ${cap(worst.m.short)} is the leak: ${ordinal(worst.rank)} of 30.`;
  if (best.rank <= 5) return `Built on ${best.m.short}: ${ordinal(best.rank)} of 30. The weakest area is ${worst.m.short} (${ordinal(worst.rank)}).`;
  return `No standout strength. ${cap(worst.m.short)} is the weakest area at ${ordinal(worst.rank)} of 30.`;
}

/** Rolling defensive rating over the last n games. */
export function defRolling(games: DefenseData["games"], n = 10) {
  const out: { game: number; value: number; date: string }[] = [];
  for (let i = n - 1; i < games.length; i++) {
    const v = games.slice(i - n + 1, i + 1).reduce((a, g) => a + g[2], 0) / n;
    out.push({ game: i + 1, value: Math.round(v * 10) / 10, date: games[i][0] });
  }
  return out;
}

export function defTrendHeadline(abbr: string, series: ReturnType<typeof defRolling>, league: number) {
  if (series.length < 5) return "Not enough games yet for a 10-game trend. Check back after game 15.";
  const last = series[series.length - 1];
  const best = series.reduce((a, b) => (b.value < a.value ? b : a));
  const gap = league - last.value;
  if (gap >= 0)
    return `${abbr} allow ${last.value} per 100 over the last 10, ${gap.toFixed(1)} better than the league. Best stretch: ${best.value} by game ${best.game}.`;
  return `${abbr} allow ${last.value} per 100 over the last 10, ${(-gap).toFixed(1)} worse than the league. Tighten up before it costs games.`;
}

/** The zone where opponents beat or miss their usual make rate by the most, weighted toward common shots. */
export function defZonesHeadline(zones: Zone[], compare: Zone[], who: string, cmpLabel: string) {
  const cmp = new Map(compare.map((z) => [z.zone, z]));
  const diffs = zones
    .filter((z) => z.share >= 0.05 && cmp.has(z.zone) && z.zone !== "Backcourt")
    .map((z) => ({ z, diff: z.fg - cmp.get(z.zone)!.fg }));
  if (!diffs.length) return "Shot locations will show here once shots are loaded.";
  const leak = diffs.reduce((a, b) => (b.diff > a.diff ? b : a));
  const wall = diffs.reduce((a, b) => (b.diff < a.diff ? b : a));
  const name = (z: Zone) => zoneName(z.zone).toLowerCase();
  if (leak.diff >= 0.02)
    return `${who} hit ${name(leak.z)} at ${pct(leak.z.fg)}, ${(leak.diff * 100).toFixed(1)} points above ${cmpLabel}. Close that gap first.`;
  return `${who} make ${name(wall.z)} at ${pct(wall.z.fg)}, ${(-wall.diff * 100).toFixed(1)} points below ${cmpLabel}. Keep forcing those.`;
}

export function defPlayersHeadline(players: DefenseData["players"]) {
  if (!players.length) return "No rotation players yet this season.";
  const by = (k: "stl36" | "blk36" | "dreb36") => players.reduce((a, b) => (b[k] > a[k] ? b : a));
  const stl = by("stl36"), blk = by("blk36");
  if (stl.player_id === blk.player_id) return `${stl.name} leads in steals and blocks per 36 minutes.`;
  return `${stl.name} creates turnovers (${stl.stl36.toFixed(1)} steals per 36). ${blk.name} protects the rim (${blk.blk36.toFixed(1)} blocks).`;
}

/** Defended FG% against expected, as percentage points ("-5.1"). Negative means shooters did worse. */
export const dfgPoints = (diff: number) => signed(diff * 100);

/** Qualified players with on/off data, best defensive impact first. */
export function impactRanking(players: DefensePlayer[]) {
  return players
    .filter((p) => p.qualified && p.onoff_drtg !== null && p.onoff_drtg !== undefined)
    .sort((a, b) => b.onoff_drtg! - a.onoff_drtg!);
}

/** One sentence on who moves the defense, e.g. "Alex Caruso is worth 7.2 points per 100 on defense. ..." */
export function defImpactHeadline(players: DefensePlayer[], teamName: string) {
  const ranked = impactRanking(players);
  const top = ranked[0];
  if (!top) return `On/off numbers show once ${teamName} players reach 500 minutes.`;
  const guard = top.dfg_diff === null || top.dfg_diff === undefined
    ? ""
    : top.dfg_diff < 0
      ? ` Opponents shoot ${Math.abs(top.dfg_diff * 100).toFixed(1)} points worse when he guards them.`
      : ` Shooters still hit ${(top.dfg_diff * 100).toFixed(1)} points better than usual against him.`;
  if (top.onoff_drtg! <= 0) {
    return `No ${teamName} player lowers the points allowed when he plays. ${top.name} comes closest at ${signed(top.onoff_drtg!)}.${guard}`;
  }
  return `${top.name} is worth ${top.onoff_drtg!.toFixed(1)} points per 100 possessions on defense.${guard}`;
}

export const MISC_META: { key: "off_tov" | "second_chance" | "fast_break" | "paint"; label: string; hint: string }[] = [
  { key: "off_tov", label: "Points off turnovers", hint: "scored right after we give the ball away" },
  { key: "second_chance", label: "Second-chance points", hint: "scored after an offensive rebound" },
  { key: "fast_break", label: "Fast-break points", hint: "scored in transition, before we set up" },
  { key: "paint", label: "Points in the paint", hint: "scored inside the lane" },
];

/** Headline for the "where they score on us" strip: name the biggest leak, or the strongest area. */
export function defMiscHeadline(misc: DefenseMisc, abbr: string) {
  const items = MISC_META.map((m) => ({ ...m, value: misc[m.key], rank: misc[`${m.key}_rank`] }));
  const worst = items.reduce((a, b) => (b.rank > a.rank ? b : a));
  if (worst.rank >= 21) {
    return `${worst.label} are the leak: ${abbr} allows ${worst.value.toFixed(1)} a game, ${ordinal(worst.rank)} of 30. Fix that first.`;
  }
  const best = items.reduce((a, b) => (b.rank < a.rank ? b : a));
  return `${abbr} has no big leak. ${best.label} are the strength: ${best.value.toFixed(1)} a game, ${ordinal(best.rank)} fewest in the league.`;
}
