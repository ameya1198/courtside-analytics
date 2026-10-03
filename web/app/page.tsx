import { Wrap, Heading, Section } from "@/components/blocks";
import { BarList } from "@/components/charts/html";
import { ThreeRateChart } from "@/components/charts/recharts";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { ordinal, parseSeason, seasonOptions, signed } from "@/lib/format";
import { onColor, teamColor, teamTheme } from "@/lib/teams";
import type { LeagueData } from "@/lib/types";

export const revalidate = 3600;

export default async function LeaguePulse({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await pageData<LeagueData>("league", [parseSeason(sp.season)]);
  const teams = d.teams ?? [];
  if (!teams.length) return <Wrap className="py-20">No team data for this season yet.</Wrap>;

  const leader = teams[0];
  const second = teams[1];
  const prev = new Map(d.prev.map((p) => [p.team_id, p.net]));
  const movers = teams
    .filter((t) => prev.has(t.team_id))
    .map((t) => ({ t, from: prev.get(t.team_id)!, change: Math.round((t.net - prev.get(t.team_id)!) * 10) / 10 }))
    .sort((a, b) => b.change - a.change);
  const risers = movers.slice(0, 5);
  const fallers = movers.slice(-5).reverse();
  const maxMove = Math.max(1, ...movers.map((m) => Math.abs(m.change)));
  const leaderPrev = prev.get(leader.team_id);
  const bestOff = teams.reduce((a, b) => (b.ortg > a.ortg ? b : a));
  const bestDef = teams.reduce((a, b) => (b.drtg < a.drtg ? b : a));
  const nextDef = [...teams].sort((a, b) => a.drtg - b.drtg).find((t) => t.abbr !== leader.abbr)!;
  const rates = d.threeRate;
  const firstRate = rates[0], lastRate = rates[rates.length - 1];

  return (
    <div style={teamTheme(leader.abbr)}>
      {/* Scoreboard strip */}
      <div className="overflow-x-auto bg-ink text-white">
        <div className="flex min-w-max">
          {teams.slice(0, 8).map((t, i) => (
            <div key={t.abbr} className="flex items-baseline gap-3 border-r border-[#272B35] px-5 py-3 font-mono text-[14px]">
              <span className="text-[#A7AEBB]">{i + 1}</span>
              <span className="display text-[20px] font-extrabold tracking-[0.04em]">{t.abbr}</span>
              <span className="text-[#A7AEBB]">{t.w}-{t.l}</span>
              <span>{signed(t.net)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="bg-hero text-hero-ink">
        <Wrap className="flex flex-wrap items-end gap-x-16 gap-y-10 pb-16 pt-12">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-1">
            <span className="label text-[13px]">League Pulse · {d.seasonLabel} · Net rating leader</span>
            <span className="display text-[clamp(110px,18vw,240px)]">{signed(leader.net)}</span>
            <span className="display text-[clamp(34px,4.4vw,56px)] font-extrabold">{leader.name}</span>
            <div className="mt-4"><ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} /></div>
          </div>
          <div className="grid min-w-0 flex-[1_1_320px] grid-cols-2 border-t-[3px] border-current">
            <div className="flex flex-col gap-0.5 py-4 pr-4">
              <span className="label">Defense</span>
              <span className="display text-[clamp(56px,6vw,84px)]">{leader.drtg.toFixed(1)}</span>
              <span className="text-[15px]">
                {leader.abbr === bestDef.abbr ? `1st. Next best: ${nextDef.abbr} at ${nextDef.drtg.toFixed(1)}` : `${ordinal(leader.def_rank!)}. Best: ${bestDef.abbr} at ${bestDef.drtg.toFixed(1)}`}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 border-l-[3px] border-current py-4 pl-4">
              <span className="label">Offense</span>
              <span className="display text-[clamp(56px,6vw,84px)]">{leader.ortg.toFixed(1)}</span>
              <span className="text-[15px]">
                {leader.abbr === bestOff.abbr ? "1st in the league" : `${ordinal(leader.off_rank!)}. Best: ${bestOff.abbr} at ${bestOff.ortg.toFixed(1)}`}
              </span>
            </div>
            <div className="display col-span-2 border-t-[3px] border-current pt-4 text-[clamp(24px,2.6vw,34px)] font-extrabold">
              {leader.w}-{leader.l} · {signed(leader.net - second.net)} clear of {second.abbr}
              {leaderPrev !== undefined ? ` · ${leader.net >= leaderPrev ? "up" : "down"} ${Math.abs(leader.net - leaderPrev).toFixed(1)} on last season` : ""}
            </div>
          </div>
        </Wrap>
      </section>

      <Wrap>
        {/* The chase */}
        <Section className="flex flex-col gap-6">
          <Heading title="The chase: next five by net rating" caption={`Net rating is points scored minus points allowed per 100 possessions. ${second.abbr} is closest, ${(leader.net - second.net).toFixed(1)} behind.`} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
            {teams.slice(1, 6).map((t, i) => {
              const bg = teamColor(t.abbr);
              return (
                <div key={t.abbr} className="flex min-h-[230px] flex-col justify-between gap-3 p-5" style={{ background: bg, color: onColor(bg) }}>
                  <div className="label flex justify-between"><span>#{i + 2}</span><span>{t.w}-{t.l}</span></div>
                  <div className="flex flex-col">
                    <span className="display text-[88px]">{t.abbr}</span>
                    <span className="display text-[40px] font-extrabold">{signed(t.net)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-current pt-2 font-mono text-[13px]"><span>OFF {t.ortg.toFixed(1)}</span><span>DEF {t.drtg.toFixed(1)}</span></div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Movers */}
        {movers.length ? (
          <Section className="flex flex-col gap-6">
            <Heading
              title={`${risers[0].t.name} gained the most: ${signed(risers[0].change)} on last season`}
              caption={`Change in net rating from last season. ${fallers[0].t.abbr} fell furthest, from ${signed(fallers[0].from)} to ${signed(fallers[0].t.net)}.`}
            />
            <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
              <div className="flex flex-col">
                <span className="label border-b-[3px] border-ink pb-2">Risers</span>
                <BarList tone="accent" max={maxMove} rows={risers.map((m) => ({ key: m.t.abbr, label: m.t.abbr, value: m.change, valueText: signed(m.change), note: `${signed(m.from)} to ${signed(m.t.net)}` }))} />
              </div>
              <div className="flex flex-col">
                <span className="label border-b-[3px] border-ink pb-2">Fallers</span>
                <BarList tone="warn" max={maxMove} rows={fallers.map((m) => ({ key: m.t.abbr, label: m.t.abbr, value: m.change, valueText: signed(m.change), note: `${signed(m.from)} to ${signed(m.t.net)}` }))} />
              </div>
            </div>
          </Section>
        ) : null}

        {/* Three-point rate */}
        {rates.length > 1 ? (
          <Section className="flex flex-col gap-6">
            <Heading
              title={`Threes are ${(lastRate.rate * 100).toFixed(1)}% of all shots. Build rosters that can shoot them.`}
              caption={`Share of field goal attempts that were threes, ${firstRate.label} to ${lastRate.label}. It was ${(firstRate.rate * 100).toFixed(1)}% in ${firstRate.label}.`}
            />
            <div className="panel px-4 pb-4 pt-6 md:px-7"><ThreeRateChart data={rates} /></div>
          </Section>
        ) : null}
      </Wrap>
    </div>
  );
}
