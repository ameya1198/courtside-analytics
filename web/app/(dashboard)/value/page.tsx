import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { ChartCard } from "@/components/chart-card";
import { Legend } from "@/components/charts/html";
import { AgeCurveChart, SalaryQuadrantChart } from "@/components/charts/recharts";
import { Hero } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { parseSeason, seasonOptions, signed } from "@/lib/format";
import { money } from "@/lib/insights";
import { myTeam } from "@/lib/my-team";
import { logoUrl, teamTheme } from "@/lib/teams";
import type { ValueData, ValuePick } from "@/lib/types";

export const metadata: Metadata = { title: "Player Value" };
export const revalidate = 3600;

// One line on what Win Shares are, used where the measure first appears on the page.
const WS_EXPLAINED =
  "Win Shares credit each player with a share of his team's wins, from offense and from defense.";
const DEFENSE_NOTE =
  "Defense counts: the ranking uses total Win Shares, offense plus defense. Box-score defense misses some of the work (positioning, contests), so check a player's on/off on the Defense tab before acting.";

// Column layouts are inline styles, not Tailwind classes, so a changed layout works even before a CSS rebuild.
const LIST_COLS = { gridTemplateColumns: "24px minmax(0,1fr) 72px 136px 84px" };
const VORP_COLS = { gridTemplateColumns: "36px minmax(180px,1.3fr) 56px minmax(0,1.6fr) 120px 70px 90px" };

// Dollars per Win Share: "$261K", or "$159.2M" for contracts that produced almost no wins
const perWs = (v: number | null) =>
  v === null ? "No wins" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000).toLocaleString()}K`;

/** Bargain or worst-contract list: salary, Win Shares split into offense and defense, and dollars per Win Share. */
function ValueList({ rows, tone }: { rows: ValuePick[]; tone: "accent" | "warn" }) {
  const grid = "grid gap-3";
  return (
    <div className="flex flex-col">
      <div className={`label ${grid} border-b-[3px] border-ink pb-2 text-muted`} style={LIST_COLS}>
        <span>#</span><span>Player</span><span className="text-right">Salary</span>
        <span className="text-right">Win Shares</span><span className="text-right">$ per WS</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.player_id} className={`row-hover ${grid} items-center border-b border-line py-3`} style={LIST_COLS}>
          <span className="font-mono text-[14px] text-muted">{i + 1}</span>
          <div className="flex min-w-0 flex-col">
            <a href={`/player?player=${r.player_id}`} className="display truncate text-[24px] font-extrabold tracking-[0.02em] hover:underline">{r.player_name}</a>
            <span className="font-mono text-[12px] text-muted">{r.team} · {r.games} games{r.vorp !== null ? ` · VORP ${r.vorp.toFixed(1)}` : ""}</span>
          </div>
          <span className="text-right font-mono text-[14px]">{money(r.salary)}</span>
          <div className="flex flex-col items-end">
            <span className="font-mono text-[15px] font-medium">{r.ws.toFixed(1)}</span>
            <span className="whitespace-nowrap font-mono text-[11px] text-muted">{r.ows.toFixed(1)} off · {r.dws.toFixed(1)} def</span>
          </div>
          <span className="display text-right text-[26px]" style={{ color: `var(--${tone})` }}>{perWs(r.per_ws)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function PlayerValue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mine = await myTeam();
  // Lists are limited to the chosen team; league medians and the chart stay league-wide for comparison
  const d = await pageData<ValueData>("value", [parseSeason(sp.season), mine?.abbr ?? null]);
  if (!d.season || !d.players.length) {
    return <Wrap className="py-20"><Empty>No salary or Win Shares data loaded yet. Run the salary loader, then rebuild dbt.</Empty></Wrap>;
  }

  const best = d.bargains[0];
  const worst = d.worst[0];
  const medS = d.medianSalary ?? 0, medW = d.medianWs ?? 0;
  const ours = d.players.filter((p) => !mine || p[2] === mine.abbr);
  const topLeft = ours.filter((p) => p[4] < medS && p[5] > medW).length;

  const curve = d.ages.filter((a) => a.players >= 20);
  const peak = curve.length ? curve.reduce((a, b) => (b.ws48 > a.ws48 ? b : a), curve[0]) : null;
  const dropAge = peak ? curve.find((a) => a.age > peak.age && a.ws48 < peak.ws48 * 0.85) : undefined;
  const ws48 = (v: number) => v.toFixed(3).replace(/^0/, "");
  const leaders = d.leaders;
  const vorpTop = leaders[0];

  return (
    <div style={teamTheme(mine?.abbr)}>
      <Hero
        eyebrow={`Player Value · ${d.seasonLabel} · ${d.pricedCount} qualified players with a known salary`}
        title="Who wins more than they cost"
        watermark={mine ? { src: logoUrl(mine.id), alt: `${mine.name} logo` } : undefined}
        controls={<ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />}
        side={
          best ? (
            <div className="flex flex-[0_1_380px] flex-col gap-1 border-t-[3px] border-current pb-16 pt-4">
              <span className="label">Best value{mine ? ` on the ${mine.name}` : ""}</span>
              <span className="display text-[64px]">{perWs(best.per_ws)}</span>
              <span className="text-[15px]">per Win Share from {best.player_name} ({best.team}): {best.ws.toFixed(1)} Win Shares for {money(best.salary)}.</span>
            </div>
          ) : null
        }
      />

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading
            title={mine
              ? `${topLeft} ${mine.name} player${topLeft === 1 ? "" : "s"} add more wins than the league median on below-median pay.`
              : `${topLeft} players add more wins than the median on below-median pay. Target them in trades.`}
            caption={`Salary against Win Shares. ${WS_EXPLAINED} Dashed lines are the medians: ${money(medS)} and ${medW.toFixed(1)} Win Shares. Top left is the best value.`}
          />
          <Legend items={[
            { label: mine ? `${mine.name} players` : "Five best bargains", color: "var(--accent)", kind: "dot" },
            { label: "Other players", color: "var(--panel-dot)", kind: "dot" },
            { label: "League medians", color: "var(--panel-muted)", kind: "dashed" },
          ]} />
          <div className="panel px-2 pb-2 pt-4">
            <SalaryQuadrantChart
              medianSalary={medS / 1e6}
              medianProduction={medW}
              highlight={mine ? ours.map((p) => p[0]) : d.bargains.map((r) => r.player_id)}
              points={d.players.map((p) => ({ id: p[0], name: p[1], team: p[2], salaryM: p[4] / 1e6, ws: p[5], perWs: p[8] }))}
            />
          </div>
        </Section>

        {/* Two equal cards side by side, with the note on defense under both */}
        <Section className="flex flex-col gap-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <ChartCard
              className="h-full"
              title={best ? `${best.player_name} is the best bargain: ${perWs(best.per_ws)} per Win Share.` : "Best bargains"}
              description="Lowest salary per Win Share. Players paid $2M or more with at least one Win Share."
            >
              {d.bargains.length ? <ValueList rows={d.bargains} tone="accent" /> : <p className="text-[14px] text-muted">No qualified bargains this season.</p>}
            </ChartCard>
            <ChartCard
              className="h-full"
              title={worst ? `${worst.player_name} cost ${perWs(worst.per_ws)} per Win Share. Revisit that contract.` : "Worst contracts"}
              description="Highest salary per Win Share, among players paid $20M or more (10+ games) who cost more per win than the league median. Missed games count against value."
            >
              {d.worst.length ? <ValueList rows={d.worst} tone="warn" /> : <p className="text-[14px] text-muted">No big contract costs more per win than the league median this season.</p>}
            </ChartCard>
          </div>
          <p className="text-[14px] text-muted">{DEFENSE_NOTE}</p>
        </Section>

        {vorpTop ? (
          <Section className="flex flex-col gap-6">
            <Heading
              title={`${vorpTop.player_name} adds the most over a replacement player: ${vorpTop.vorp.toFixed(1)} VORP.`}
              caption={`VORP (value over replacement player) is how much a player adds over a minimum-salary fill-in, from his Box Plus/Minus and minutes. The second check on value, next to Win Shares.${mine ? ` ${mine.name} players only.` : ""}`}
            />
            <Legend items={[
              { label: "Highest VORP", color: "var(--accent)" },
              { label: "Others", color: "var(--ink)" },
            ]} />
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="label grid gap-3 border-b-[3px] border-ink pb-2 text-muted" style={VORP_COLS}>
                  <span>#</span><span>Player</span><span>Team</span><span>VORP</span>
                  <span className="whitespace-nowrap text-right">BPM off / def</span><span className="text-right">WS</span><span className="text-right">Salary</span>
                </div>
                {leaders.map((r, i) => (
                  <div key={r.player_id} className="row-hover grid items-center gap-3 border-b border-line py-3" style={VORP_COLS}>
                    <span className="font-mono text-[14px] text-muted">{i + 1}</span>
                    <a href={`/player?player=${r.player_id}&season=${d.season}`} className="display text-[24px] font-extrabold tracking-[0.02em] hover:underline">{r.player_name}</a>
                    <span className="font-mono text-[14px] font-medium">{r.team}</span>
                    <div className="flex items-center gap-3">
                      <div className="relative h-[20px] flex-1 rounded-[4px] bg-soft">
                        <div className="absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${Math.max(0, r.vorp / vorpTop.vorp) * 100}%`, background: i === 0 ? "var(--accent)" : "var(--ink)" }} />
                      </div>
                      <span className="display w-14 text-right text-[26px]">{r.vorp.toFixed(1)}</span>
                    </div>
                    <span className="text-right font-mono text-[14px]">{r.obpm === null ? "-" : `${signed(r.obpm)} / ${signed(r.dbpm ?? 0)}`}</span>
                    <span className="text-right font-mono text-[14px]">{r.ws === null ? "-" : r.ws.toFixed(1)}</span>
                    <span className="text-right font-mono text-[14px]">{r.salary ? money(r.salary) : "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        ) : null}

        {peak ? (
          <Section>
            <ChartCard
              title={
                dropAge
                  ? `Win Shares per 48 peak at ${peak.age} and are down 15% by ${dropAge.age}. Price long deals past ${dropAge.age - 1} with care.`
                  : `Win Shares per 48 peak at ${peak.age}, and players who keep a starter's minutes into their 30s hold their level. Pay for the role, not the birthday.`
              }
              description="Win Shares per 48 minutes by age, every season we hold. It puts players with different minutes on the same footing."
              trend={`Peak at ${peak.age}: ${ws48(peak.ws48)} Win Shares per 48`}
              direction="up"
              legend={[{ label: "Peak age", color: "var(--accent)" }, { label: "Other ages", color: "var(--panel-dot)" }]}
              note="Counts players with 500+ minutes who played regular rotation minutes, so older ages show the survivors. Ages with fewer than 20 player-seasons are left out."
            >
              <AgeCurveChart peak={peak.age} data={curve.map((a) => ({ age: a.age, ws48: a.ws48, players: a.players }))} />
            </ChartCard>
          </Section>
        ) : null}
      </Wrap>
    </div>
  );
}
