import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { AgeCurveChart, SalaryQuadrantChart } from "@/components/charts/recharts";
import { Hero } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { dec3, parseSeason, seasonOptions } from "@/lib/format";
import { money } from "@/lib/insights";
import { teamTheme } from "@/lib/teams";
import type { ValueData } from "@/lib/types";

export const metadata: Metadata = { title: "Player Value" };
export const revalidate = 3600;

function ValueList({ rows, tone, valueNote }: {
  rows: { player_id: number; player_name: string; team: string; salary: number; fantasy_ppg: number; per_pt: number; games?: number }[];
  tone: "accent" | "warn"; valueNote: (r: { per_pt: number }) => string;
}) {
  return (
    <div className="flex flex-col">
      <div className="label grid grid-cols-[28px_minmax(0,1fr)_84px_84px] gap-3 border-b-[3px] border-ink pb-2">
        <span>#</span><span>Player</span><span className="text-right">Salary</span><span className="text-right">$ per pt</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.player_id} className="grid grid-cols-[28px_minmax(0,1fr)_84px_84px] items-center gap-3 border-b border-line py-3">
          <span className="font-mono text-[14px] text-muted">{i + 1}</span>
          <div className="flex min-w-0 flex-col">
            <a href={`/player?player=${r.player_id}`} className="display truncate text-[24px] font-extrabold tracking-[0.02em] hover:underline">{r.player_name}</a>
            <span className="font-mono text-[12px] text-muted">{r.team} · {r.fantasy_ppg} fantasy pts a game{r.games !== undefined ? ` · ${r.games} games` : ""}</span>
          </div>
          <span className="text-right font-mono text-[14px]">{money(r.salary)}</span>
          <span className="display text-right text-[26px]" style={{ color: `var(--${tone})` }}>{valueNote(r)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function PlayerValue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await pageData<ValueData>("value", [parseSeason(sp.season)]);
  if (!d.season || !d.players.length) {
    return <Wrap className="py-20"><Empty>No salary data loaded yet. Run the salary loader, then rebuild dbt.</Empty></Wrap>;
  }

  const perPt = (r: { per_pt: number }) => `$${Math.round(r.per_pt).toLocaleString()}`;
  const best = d.bargains[0];
  const worst = d.worst[0];
  const medS = d.medianSalary ?? 0, medP = d.medianProduction ?? 0;
  const topLeft = d.players.filter((p) => p[4] < medS && p[5] > medP).length;

  const curve = d.ages.filter((a) => a.players >= 20);
  const peak = curve.reduce((a, b) => (b.fantasy_ppg > a.fantasy_ppg ? b : a), curve[0]);
  const dropAge = peak ? curve.find((a) => a.age > peak.age && a.fantasy_ppg < peak.fantasy_ppg * 0.9) : undefined;
  const leaders = d.leaders;

  return (
    <div style={teamTheme(null)}>
      <Hero
        eyebrow={`Player Value · ${d.seasonLabel} · ${d.pricedCount} qualified players with a known salary`}
        title="Who produces more than they cost"
        controls={<ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />}
        side={
          best ? (
            <div className="flex flex-[0_1_380px] flex-col gap-1 border-t-[3px] border-current pb-12 pt-4">
              <span className="label">Best value in the league</span>
              <span className="display text-[64px]">{perPt(best)}</span>
              <span className="text-[15px]">per fantasy point from {best.player_name} ({best.team}), paid {money(best.salary)}.</span>
            </div>
          ) : null
        }
      />

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading
            title={`${topLeft} players produce above the median on below-median pay. Target them in trades.`}
            caption={`Salary against NBA fantasy points per game (points, rebounds, assists, steals, blocks, minus turnovers). Dashed lines are the medians: ${money(medS)} and ${medP.toFixed(1)} points. Top left is the best value.`}
          />
          <div className="panel px-2 pb-2 pt-4">
            <SalaryQuadrantChart
              medianSalary={medS / 1e6}
              medianProduction={medP}
              highlight={[...d.bargains.slice(0, 3), ...d.worst.slice(0, 3)].map((r) => r.player_id)}
              points={d.players.map((p) => ({ id: p[0], name: p[1], team: p[2], salaryM: p[4] / 1e6, fppg: p[5] }))}
            />
          </div>
        </Section>

        <Section className="grid gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Heading size="md" title={best ? `${best.player_name} is the best bargain: ${perPt(best)} per fantasy point.` : "Best bargains"} caption="Lowest salary per fantasy point, qualified players paid $2M or more." />
            <ValueList rows={d.bargains} tone="accent" valueNote={perPt} />
          </div>
          <div className="flex flex-col gap-5">
            <Heading size="md" title={worst ? `${worst.player_name} cost ${perPt(worst)} per fantasy point. Revisit that contract.` : "Worst contracts"} caption="Highest salary per fantasy point, players paid $20M or more with 10+ games. Missed games count against value." />
            <ValueList rows={d.worst} tone="warn" valueNote={perPt} />
          </div>
        </Section>

        {peak ? (
          <Section className="flex flex-col gap-6">
            <Heading
              title={`Production peaks at ${peak.age}${dropAge ? ` and is down 10% by ${dropAge.age}. Price long deals past ${dropAge.age - 1} with care.` : "."}`}
              caption="Average fantasy points per game by age, qualified players, every season we hold. Ages with fewer than 20 player-seasons are left out."
            />
            <div className="panel px-4 pb-4 pt-4 md:px-7">
              <AgeCurveChart peak={peak.age} data={curve.map((a) => ({ age: a.age, fppg: a.fantasy_ppg, players: a.players }))} />
            </div>
          </Section>
        ) : null}

        {leaders.length ? (
          <Section className="flex flex-col gap-6">
            <Heading title={`${leaders[0].player_name} leads in scoring per 36 minutes.`} caption="Production leaders, with what they are paid." />
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="label grid grid-cols-[36px_minmax(180px,1.3fr)_56px_minmax(0,1.6fr)_70px_70px_90px] gap-3 border-b-[3px] border-ink pb-2">
                  <span>#</span><span>Player</span><span>Team</span><span>Points per 36</span><span className="text-right">PPG</span><span className="text-right">TS%</span><span className="text-right">Salary</span>
                </div>
                {leaders.map((r, i) => (
                  <div key={r.player_id} className="grid grid-cols-[36px_minmax(180px,1.3fr)_56px_minmax(0,1.6fr)_70px_70px_90px] items-center gap-3 border-b border-line py-3">
                    <span className="font-mono text-[14px] text-muted">{i + 1}</span>
                    <a href={`/player?player=${r.player_id}&season=${d.season}`} className="display text-[24px] font-extrabold tracking-[0.02em] hover:underline">{r.player_name}</a>
                    <span className="font-mono text-[14px] font-medium">{r.team}</span>
                    <div className="flex items-center gap-3">
                      <div className="relative h-[20px] flex-1 bg-soft"><div className="absolute inset-y-0 left-0" style={{ width: `${(r.p36 / leaders[0].p36) * 100}%`, background: i === 0 ? "var(--accent)" : "var(--ink)" }} /></div>
                      <span className="display w-14 text-right text-[26px]">{r.p36.toFixed(1)}</span>
                    </div>
                    <span className="text-right font-mono text-[14px]">{r.ppg.toFixed(1)}</span>
                    <span className="text-right font-mono text-[14px]">{dec3(r.ts)}</span>
                    <span className="text-right font-mono text-[14px]">{r.salary ? money(r.salary) : "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        ) : null}
      </Wrap>
    </div>
  );
}
