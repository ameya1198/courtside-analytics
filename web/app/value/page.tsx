import type { Metadata } from "next";
import { Heading, Notice, Placeholder, Section, Wrap } from "@/components/blocks";
import { Hero } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { dec3, parseSeason, seasonOptions } from "@/lib/format";
import { teamTheme } from "@/lib/teams";
import type { PlayerData } from "@/lib/types";

export const metadata: Metadata = { title: "Player Value" };
export const revalidate = 3600;

export default async function PlayerValue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await pageData<PlayerData>("player", [parseSeason(sp.season), null]);
  const leaders = [...(d.pool ?? [])].sort((a, b) => b[4] - a[4]).slice(0, 10);
  const top = leaders[0];
  const max = top ? top[4] : 1;
  const cutoff = leaders[leaders.length - 1];

  return (
    <div style={teamTheme(null)}>
      <Hero
        eyebrow={`Player Value · ${d.seasonLabel}`}
        title="Who produces more than they cost"
        controls={<ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />}
        side={
          top ? (
            <div className="flex flex-[0_1_360px] flex-col gap-1 border-t-[3px] border-current pb-12 pt-4">
              <span className="label">Top producer, points per 36</span>
              <span className="display text-[96px]">{top[4].toFixed(1)}</span>
              <span className="text-[15px]">{top[1]}, {top[2]}, on {dec3(top[5])} true shooting</span>
            </div>
          ) : null
        }
      />
      <Notice>Production is live. Salary and age are not loaded yet, so the dashed panels hold the cost side of this page.</Notice>

      <Wrap>
        {top ? (
          <Section className="flex flex-col gap-6">
            <Heading
              title={`${leaders.length} players score ${cutoff[4].toFixed(1)}+ points per 36 minutes. Price contracts against this list.`}
              caption={`Production leaders among players with ${d.minGames}+ games and 20+ minutes a game.`}
            />
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="label grid grid-cols-[36px_minmax(180px,1.3fr)_56px_minmax(0,2fr)_70px_70px] gap-3 border-b-[3px] border-ink pb-2">
                  <span>#</span><span>Player</span><span>Team</span><span>Points per 36</span><span className="text-right">PPG</span><span className="text-right">TS%</span>
                </div>
                {leaders.map((r, i) => (
                  <div key={r[0]} className="grid grid-cols-[36px_minmax(180px,1.3fr)_56px_minmax(0,2fr)_70px_70px] items-center gap-3 border-b border-line py-3">
                    <span className="font-mono text-[14px] text-muted">{i + 1}</span>
                    <a href={`/player?player=${r[0]}&season=${d.season}`} className="display text-[26px] font-extrabold tracking-[0.02em] hover:underline">{r[1]}</a>
                    <span className="font-mono text-[14px] font-medium">{r[2]}</span>
                    <div className="flex items-center gap-3">
                      <div className="relative h-[22px] flex-1 bg-soft"><div className="absolute inset-y-0 left-0" style={{ width: `${(r[4] / max) * 100}%`, background: i === 0 ? "var(--accent)" : "var(--ink)" }} /></div>
                      <span className="display w-14 text-right text-[28px]">{r[4].toFixed(1)}</span>
                    </div>
                    <span className="text-right font-mono text-[15px]">{r[3].toFixed(1)}</span>
                    <span className="text-right font-mono text-[15px]">{dec3(r[5])}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        ) : null}

        <Section className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-5">
            <Heading size="md" title="Bargains: star production on role-player money" caption="Salary against production. The top-left corner gives the most for the money." />
            <Placeholder title="Salary vs production quadrant" need="Needs a salary source joined to players. Planned: a salaries seed in dbt, refreshed each off-season." />
          </div>
          <div className="flex flex-col gap-5">
            <Heading size="md" title="When production peaks" caption="Average production by age across the league." />
            <Placeholder title="Age curve" need="Needs player birth dates from the nba_api player info endpoint." />
          </div>
        </Section>
        <Section className="grid gap-12 md:grid-cols-2">
          <Placeholder title="Best bargains" need="Ranks production per salary dollar once salaries are loaded." />
          <Placeholder title="Worst contracts" need="Ranks salary per unit of production once salaries are loaded." />
        </Section>
      </Wrap>
    </div>
  );
}
