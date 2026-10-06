import type { Metadata } from "next";
import { Empty, Section, Wrap } from "@/components/blocks";
import { ChartCard } from "@/components/chart-card";
import { ShotHeatmap } from "@/components/charts/html";
import { GameBarsChart, HorizontalBarChart, VolumeEfficiencyChart } from "@/components/charts/recharts";
import { Hero, KpiRow } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { RemoteImage } from "@/components/remote-image";
import { pageData } from "@/lib/db";
import { dec3, one, ordinal, parseSeason, seasonOptions, shortDate, signed } from "@/lib/format";
import { dfgPoints, formHeadline, money, percentileHeadline } from "@/lib/insights";
import { myTeam } from "@/lib/my-team";
import { headshotUrl, teamTheme } from "@/lib/teams";
import type { PlayerData, PoolRow } from "@/lib/types";

export const metadata: Metadata = { title: "Player Profile" };
export const revalidate = 3600;

export default async function PlayerProfile({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = Number(one(sp.player));
  const season = parseSeason(sp.season);
  const mine = await myTeam();
  let d = await pageData<PlayerData>("player", [season, Number.isFinite(id) && id > 0 ? id : null]);
  // Only players who appeared for the chosen team that season (traded players count for both teams)
  const onTeam = (r: PoolRow) => !mine || (r[7] ?? [r[2]]).includes(mine.abbr);
  if (mine && !d.pool?.some((r) => r[0] === d.player?.player_id && onTeam(r))) {
    // The pool is sorted ranked players first, then by points: open the team's best ranked player
    const top = d.pool?.find(onTeam);
    if (top) d = await pageData<PlayerData>("player", [season, top[0]]);
  }
  const p = d.player;
  if (mine && p && !d.pool?.some((r) => r[0] === p.player_id && onTeam(r))) return <Wrap className="py-20"><Empty>No {mine.name} players have played this season yet.</Empty></Wrap>;
  if (!p) return <Wrap className="py-20"><Empty>No player data for this season yet.</Empty></Wrap>;

  // The dropdown lists every player who appeared for the chosen team that season
  const pool = (d.pool ?? []).filter(onTeam);
  const last5 = d.lastGames.slice(-5);
  const recent5 = last5.length ? last5.reduce((a, g) => a + g.pts, 0) / last5.length : null;
  const pc = d.percentiles;
  const def = d.defense ?? null;
  const rimShare = d.shots.total ? d.shots.rimFga / d.shots.total : 0;
  const rimFg = d.shots.rimFga ? d.shots.rimFgm / d.shots.rimFga : 0;
  const options = pool.some((r) => r[0] === p.player_id)
    ? pool.map((r) => ({ value: String(r[0]), label: `${r[1]} · ${(r[7] ?? [r[2]]).join("/")}` }))
    : [{ value: String(p.player_id), label: `${p.name} · ${p.team}` }, ...pool.map((r) => ({ value: String(r[0]), label: `${r[1]} · ${(r[7] ?? [r[2]]).join("/")}` }))];

  return (
    <div style={teamTheme(p.team)}>
      <Hero
        eyebrow={["Player Profile", p.team, d.value?.age ? `Age ${Math.floor(d.value.age)}` : null, d.value?.salary ? `${money(d.value.salary)} salary` : null, `${p.gp} games`, d.seasonLabel].filter(Boolean).join(" · ")}
        title={p.name}
        controls={
          <>
            <ParamSelect name="player" label="Player" value={String(p.player_id)} options={options} />
            <ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />
          </>
        }
        // Large photo on wide screens (lg and up), the smaller inline one below that
        portrait={
          <RemoteImage src={headshotUrl(p.player_id)} alt={p.name} className="h-full w-auto max-w-[44vw] object-contain object-bottom" />
        }
        side={
          <div className="relative flex min-w-[260px] flex-[0_1_440px] items-end justify-center self-stretch lg:hidden">
            <RemoteImage src={headshotUrl(p.player_id)} alt={p.name} className="relative z-10 h-auto w-full max-w-[440px]" />
          </div>
        }
      >
        <KpiRow
          items={[
            { label: "Points", value: p.ppg.toFixed(1), note: `per game, ${p.mpg.toFixed(1)} minutes` },
            { label: "Rebounds", value: p.rpg.toFixed(1), note: "per game" },
            { label: "Assists", value: p.apg.toFixed(1), note: "per game" },
            { label: "True shooting", value: dec3(p.ts), note: `${p.p36.toFixed(1)} points per 36` },
          ]}
        />
      </Hero>

      <Wrap>
        {/* Row 1: two equal cards side by side */}
        <Section className="grid items-stretch gap-6 lg:grid-cols-2">
          {pc ? (
            <ChartCard
                  className="h-full"
                  title={percentileHeadline(pc)}
                  description={`Percentile among ${d.qualifiedCount} players with ${d.minGames}+ games and 20+ minutes`}
                  legend={[
                    { label: "90th percentile or better", color: "var(--accent)" },
                    { label: "Below 90th", color: "var(--ink)" },
                    { label: "Middle of the pack (50)", color: "var(--panel-muted)", kind: "dashed" },
                  ]}
                  note="100 is best."
                >
                  <HorizontalBarChart
                    name="Percentile" icon="medal" domain={[0, 100]} refLine={50} categoryWidth={136} bigValues
                    data={([
                      ["Points", pc.pts], ["Rebounds", pc.reb], ["Assists", pc.ast], ["Steals", pc.stl],
                      ["Blocks", pc.blk], ["True shooting", pc.ts], ["3-point %", pc.fg3],
                    ] as const).map(([label, v]) => ({
                      key: label, label, value: v, valueText: String(v),
                      fill: v >= 90 ? "var(--accent)" : "var(--ink)",
                    }))}
                  />
                </ChartCard>
          ) : (
            <Empty>{p.name} has not played enough games or minutes to be ranked yet.</Empty>
          )}
            <ChartCard
              className="h-full"
              title={formHeadline(d.lastGames, p.ppg)}
              description={`Points in each of the last ${d.lastGames.length} games, oldest to newest`}
              trend={recent5 !== null ? `${recent5.toFixed(1)} points a game over the last 5, against ${p.ppg.toFixed(1)} for the season` : undefined}
              direction={recent5 !== null && recent5 < p.ppg ? "down" : "up"}
              legend={[
                { label: "Win", color: "var(--accent)" },
                { label: "Loss", color: "var(--warn)" },
                { label: "Season average", color: "var(--panel-muted)", kind: "dashed" },
              ]}
              note="Each bar is his points in that game."
            >
              <GameBarsChart
                average={p.ppg}
                data={d.lastGames.map((g) => ({
                  label: g.opp, pts: g.pts, win: g.win, reb: g.reb, ast: g.ast,
                  // Tooltip heading; the result and stats show as icon rows below it
                  tip: `${shortDate(g.game_date)} ${g.home ? "vs" : "at"} ${g.opp}`,
                }))}
              />
            </ChartCard>
        </Section>

        {/* Row 2: clutch numbers across the full width */}
        {d.clutch ? (
          <Section>
                  <div className="grid grid-cols-3 gap-3 border-t-[3px] border-ink pt-4">
                    <div className="flex flex-col"><span className="label">Clutch points</span><span className="display text-[44px]">{d.clutch.pts}</span><span className="font-mono text-[12px] text-muted">{ordinal(d.clutch.pts_rank)} in the league</span></div>
                    <div className="flex flex-col"><span className="label">Clutch TS%</span><span className="display text-[44px]">{d.clutch.ts === null ? "-" : dec3(d.clutch.ts)}</span><span className="font-mono text-[12px] text-muted">{d.clutch.games} clutch games</span></div>
                    <div className="flex flex-col"><span className="label">Clutch +/-</span><span className="display text-[44px]">{signed(d.clutch.plus_minus, 0)}</span><span className="font-mono text-[12px] text-muted">{d.clutch.minutes.toFixed(0)} minutes</span></div>
                  </div>
          </Section>
        ) : null}

        {/* Row 3: defense in one full-width card, numbers on the left and percentiles on the right */}
        {def ? (
          <Section>
            <ChartCard
                title={!def.qualified
                  ? `Defense: not enough minutes to rank yet (${Math.round(def.on_min)} of 500).`
                  : def.onoff_drtg !== null && def.onoff_drtg > 0
                    ? `${def.team} allows ${def.onoff_drtg.toFixed(1)} fewer points per 100 possessions with ${p.name.split(" ")[0]} on the court.`
                    : `${def.team} allows ${Math.abs(def.onoff_drtg ?? 0).toFixed(1)} more points per 100 possessions with ${p.name.split(" ")[0]} on the court.`}
              description="On/off: points allowed per 100 possessions with him off the court minus with him on. Defended FG%: how opponents shoot when he is the closest defender, against what those shooters usually hit."
              legend={[
                { label: "90th percentile or better", color: "var(--accent)" },
                { label: "Below 90th", color: "var(--ink)" },
                { label: "Middle of the pack (50)", color: "var(--panel-muted)", kind: "dashed" },
              ]}
              note="On/off depends on who he plays with, so treat it as a signal. Percentiles are among players with 500+ minutes and 20+ games."
            >
              <div className="grid items-center gap-8 lg:grid-cols-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col"><span className="label">On/off</span><span className="display text-[44px]">{def.onoff_drtg === null ? "-" : signed(def.onoff_drtg)}</span><span className="font-mono text-[12px] text-muted">per 100, {Math.round(def.on_min)} min</span></div>
                  <div className="flex flex-col"><span className="label">Defended FG%</span><span className="display text-[44px]">{def.dfg_diff === null ? "-" : dfgPoints(def.dfg_diff)}</span><span className="font-mono text-[12px] text-muted">vs expected, {def.dfga ?? 0} shots</span></div>
                  <div className="flex flex-col"><span className="label">At the rim</span><span className="display text-[44px]">{def.dfg_diff_rim === null ? "-" : dfgPoints(def.dfg_diff_rim)}</span><span className="font-mono text-[12px] text-muted">vs expected, {def.dfga_rim ?? 0} shots</span></div>
                </div>
                {def.qualified ? (
                  <div>
                    <HorizontalBarChart
                      name="Percentile" icon="medal" domain={[0, 100]} refLine={50} categoryWidth={136} bigValues
                      data={([
                        ["On/off", def.onoff_pctile], ["Defended FG%", def.dfg_pctile],
                        ["Contests", def.contests_pctile], ["Deflections", def.deflections_pctile],
                      ] as const).filter(([, v]) => v !== null).map(([label, v]) => ({
                        key: label, label, value: v!, valueText: String(v),
                        fill: v! >= 90 ? "var(--accent)" : "var(--ink)",
                      }))}
                    />
                  </div>
                ) : (
                  <p className="text-[14px] text-muted">Not enough minutes to rank yet.</p>
                )}
              </div>
            </ChartCard>
          </Section>
        ) : null}

        {/* Row 4: shot map and volume vs efficiency, two equal cards */}
        <Section className="grid items-stretch gap-6 lg:grid-cols-2">
          <ChartCard
            className="h-full"
            title={d.shots.total ? `${Math.round(rimShare * 100)}% of his shots come within 4 feet, and ${Math.round(rimFg * 100)}% go in.` : "No shot locations for this season."}
            description={`Where all ${d.shots.total.toLocaleString()} of his shots came from. Red means more shots, blue fewer.`}
          >
            {d.shots.total ? <ShotHeatmap bins={d.shots.bins} /> : null}
          </ChartCard>
          <ChartCard
            className="h-full"
            title={pc ? `${ordinal(pc.p36_rank)} in points per 36 minutes, on ${dec3(p.ts)} true shooting.` : `${p.p36.toFixed(1)} points per 36 minutes, on ${dec3(p.ts)} true shooting.`}
            description="Scoring volume against efficiency for every qualified player. Top right is best."
            legend={[
              { label: p.name, color: "var(--accent)", kind: "dot" },
              { label: "Other qualified players", color: "var(--panel-dot)", kind: "dot" },
            ]}
          >
            <VolumeEfficiencyChart selected={p.player_id} points={pool.map((r) => ({ id: r[0], name: r[1], team: r[2], p36: r[4], ts: r[5] }))} />
          </ChartCard>
        </Section>
      </Wrap>
    </div>
  );
}
