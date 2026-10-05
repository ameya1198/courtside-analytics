import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { PercentileBars, ShotHeatmap } from "@/components/charts/html";
import { GameBarsChart, VolumeEfficiencyChart } from "@/components/charts/recharts";
import { Hero, KpiRow } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { RemoteImage } from "@/components/remote-image";
import { pageData } from "@/lib/db";
import { dec3, one, ordinal, parseSeason, seasonOptions, shortDate, signed } from "@/lib/format";
import { formHeadline, money, percentileHeadline } from "@/lib/insights";
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
  const onTeam = (r: PoolRow) => !mine || r[7].includes(mine.abbr);
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
  const pc = d.percentiles;
  const rimShare = d.shots.total ? d.shots.rimFga / d.shots.total : 0;
  const rimFg = d.shots.rimFga ? d.shots.rimFgm / d.shots.rimFga : 0;
  const options = pool.some((r) => r[0] === p.player_id)
    ? pool.map((r) => ({ value: String(r[0]), label: `${r[1]} · ${r[7].join("/")}` }))
    : [{ value: String(p.player_id), label: `${p.name} · ${p.team}` }, ...pool.map((r) => ({ value: String(r[0]), label: `${r[1]} · ${r[7].join("/")}` }))];

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
        <Section className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-5">
            {pc ? (
              <>
                <Heading size="md" title={percentileHeadline(pc)} caption={`Percentile among ${d.qualifiedCount} players with ${d.minGames}+ games and 20+ minutes. 100 is best.`} />
                <PercentileBars
                  rows={[
                    { label: "Points", value: pc.pts }, { label: "Rebounds", value: pc.reb }, { label: "Assists", value: pc.ast },
                    { label: "Steals", value: pc.stl }, { label: "Blocks", value: pc.blk }, { label: "True shooting", value: pc.ts },
                    { label: "3-point %", value: pc.fg3 },
                  ]}
                />
                <span className="text-[13px] text-muted">The black line marks the middle of the pack.</span>
                {d.clutch ? (
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t-[3px] border-ink pt-4">
                    <div className="flex flex-col"><span className="label">Clutch points</span><span className="display text-[44px]">{d.clutch.pts}</span><span className="font-mono text-[12px] text-muted">{ordinal(d.clutch.pts_rank)} in the league</span></div>
                    <div className="flex flex-col"><span className="label">Clutch TS%</span><span className="display text-[44px]">{d.clutch.ts === null ? "-" : dec3(d.clutch.ts)}</span><span className="font-mono text-[12px] text-muted">{d.clutch.games} clutch games</span></div>
                    <div className="flex flex-col"><span className="label">Clutch +/-</span><span className="display text-[44px]">{signed(d.clutch.plus_minus, 0)}</span><span className="font-mono text-[12px] text-muted">{d.clutch.minutes.toFixed(0)} minutes</span></div>
                  </div>
                ) : null}
              </>
            ) : (
              <Empty>{p.name} has not played enough games or minutes to be ranked yet.</Empty>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <Heading size="md" title={formHeadline(d.lastGames, p.ppg)} caption={`Points in each of the last ${d.lastGames.length} games, oldest to newest. Dashed line: season average. Losses in the warning colour.`} />
            <div className="panel px-3 pb-3 pt-5">
              <GameBarsChart
                average={p.ppg}
                data={d.lastGames.map((g) => ({
                  label: g.opp, pts: g.pts, win: g.win,
                  tip: `${shortDate(g.game_date)} ${g.home ? "vs" : "at"} ${g.opp} · ${g.win ? "W" : "L"} · ${g.pts} pts, ${g.reb} reb, ${g.ast} ast`,
                }))}
              />
            </div>
          </div>
        </Section>

        <Section className="grid gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Heading
              size="md"
              title={d.shots.total ? `${Math.round(rimShare * 100)}% of his shots come within 4 feet, and ${Math.round(rimFg * 100)}% go in.` : "No shot locations for this season."}
              caption={`Where all ${d.shots.total.toLocaleString()} of his shots came from. Brighter means more shots.`}
            />
            {d.shots.total ? <div className="panel p-4"><ShotHeatmap bins={d.shots.bins} /></div> : null}
          </div>
          <div className="flex flex-col gap-5">
            <Heading
              size="md"
              title={pc ? `${ordinal(pc.p36_rank)} in points per 36 minutes, on ${dec3(p.ts)} true shooting.` : `${p.p36.toFixed(1)} points per 36 minutes, on ${dec3(p.ts)} true shooting.`}
              caption="Scoring volume against efficiency for every qualified player. Top right is best."
            />
            <div className="panel px-2 pb-2 pt-4">
              <VolumeEfficiencyChart selected={p.player_id} points={pool.map((r) => ({ id: r[0], name: r[1], team: r[2], p36: r[4], ts: r[5] }))} />
            </div>
          </div>
        </Section>
      </Wrap>
    </div>
  );
}
