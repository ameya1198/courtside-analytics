import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { FactorTable, ZoneRows } from "@/components/charts/html";
import { RollingMarginChart } from "@/components/charts/recharts";
import { Hero, KpiRow } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { ordinal, one, parseSeason, seasonOptions, signed } from "@/lib/format";
import { clutchHeadline, factorsHeadline, rolling, rollingHeadline, splits, splitsHeadline, zonesHeadline } from "@/lib/insights";
import { logoUrl, teamTheme } from "@/lib/teams";
import type { TeamData } from "@/lib/types";

export const metadata: Metadata = { title: "Team Report" };
export const revalidate = 3600;

export default async function TeamReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await pageData<TeamData>("team", [parseSeason(sp.season), one(sp.team)]);
  const t = d.team;
  if (!t) return <Wrap className="py-20"><Empty>No games for this team and season yet.</Empty></Wrap>;

  const series = rolling(d.games);
  const s = splits(d.games);
  const f = d.factors;

  const splitCards = [
    { label: "Home", v: s.home, style: "bg-accent text-accent-ink" },
    { label: "Away", v: s.away, style: "bg-soft text-ink" },
    { label: "Back-to-back", v: s.b2b, style: "bg-warn text-warn-ink" },
    { label: "Rested", v: s.rested, style: "bg-ink text-white" },
  ];

  return (
    <div style={teamTheme(t.abbr)}>
      <Hero
        eyebrow={`Team Report · ${t.conf}ern Conference · ${d.seasonLabel}`}
        title={t.name}
        watermark={{ src: logoUrl(t.team_id), alt: `${t.name} logo` }}
        controls={
          <>
            <ParamSelect name="team" label="Team" value={t.abbr} options={d.teams.map((x) => ({ value: x.abbr, label: x.abbr }))} />
            <ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />
          </>
        }
      >
        <KpiRow
          items={[
            { label: "Record", value: `${t.w}-${t.l}`, note: `${ordinal(t.win_rank!)} by win rate` },
            { label: "Net rating", value: signed(t.net), note: `${ordinal(t.net_rank!)} of 30` },
            { label: "Offense", value: t.ortg.toFixed(1), note: `${ordinal(t.off_rank!)} of 30` },
            { label: "Defense", value: t.drtg.toFixed(1), note: `${ordinal(t.def_rank!)} of 30` },
          ]}
        />
      </Hero>

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading title={rollingHeadline(t.abbr, series)} caption="Average point margin over the last 10 games, game by game." />
          {series.length >= 2 ? (
            <div className="panel px-3 pb-3 pt-5 md:px-6"><RollingMarginChart data={series} /></div>
          ) : (
            <Empty>The 10-game trend starts after game 10.</Empty>
          )}
        </Section>

        <Section className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-5">
            {f ? (
              <>
                <Heading size="md" title={factorsHeadline(f)} caption="Offense, four factors. Rank out of 30 teams." />
                <FactorTable
                  abbr={t.abbr}
                  team={f}
                  league={d.leagueFactors}
                  ranks={{ efg: f.efg_rank, tov: f.tov_rank, orb: f.orb_rank, ftr: f.ftr_rank }}
                />
              </>
            ) : null}
          </div>
          <div className="flex flex-col gap-5">
            <Heading size="md" title={splitsHeadline(s)} caption={`Average margin by situation. ${s.b2b.games} games were back-to-backs.`} />
            <div className="grid grid-cols-2 gap-3">
              {splitCards.map((c) => (
                <div key={c.label} className={`flex min-h-[150px] flex-col justify-between gap-1.5 p-4 ${c.style}`}>
                  <span className="label">{c.label}</span>
                  <span className="display text-[56px]">{c.v.games ? signed(c.v.margin) : "-"}</span>
                  <span className="font-mono text-[13px]">{c.v.wins}-{c.v.games - c.v.wins} · {c.v.games} games</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section className="grid gap-12 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-5">
            <Heading size="md" title={zonesHeadline(d.zones, d.leagueZones)} caption="Share of shots and make rate by zone, against the league average." />
            {d.zones.length ? <ZoneRows zones={d.zones} compare={d.leagueZones} abbr={t.abbr} compareLabel="League" /> : <Empty>No shot data for this season.</Empty>}
          </div>
          <div className="flex flex-col gap-5">
            {d.clutch ? (
              <>
                <Heading size="md" title={clutchHeadline(t.abbr, d.clutch)} caption="Last 5 minutes of a game with the score within 5 points." />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-h-[140px] flex-col justify-between gap-1 bg-ink p-4 text-white">
                    <span className="label">Clutch record</span>
                    <span className="display text-[52px]">{d.clutch.w}-{d.clutch.l}</span>
                    <span className="font-mono text-[13px]">{ordinal(d.clutch.win_rank)} of {d.clutch.teams} by win rate</span>
                  </div>
                  <div className={`flex min-h-[140px] flex-col justify-between gap-1 p-4 ${d.clutch.net_rank <= 10 ? "bg-accent text-accent-ink" : d.clutch.net_rank > d.clutch.teams - 10 ? "bg-warn text-warn-ink" : "bg-soft text-ink"}`}>
                    <span className="label">Clutch net rating</span>
                    <span className="display text-[52px]">{d.clutch.net === null ? "-" : signed(d.clutch.net)}</span>
                    <span className="font-mono text-[13px]">{ordinal(d.clutch.net_rank)} of {d.clutch.teams}</span>
                  </div>
                  <div className="col-span-2 flex items-baseline justify-between border-t-[3px] border-ink pt-3">
                    <span className="label">Games that reached clutch time</span>
                    <span className="display text-[36px]">{d.clutch.games} of {t.gp ?? t.w + t.l}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Heading size="md" title="Clutch record" caption="Last 5 minutes of a game with the score within 5 points." />
                <Empty>No clutch games yet this season.</Empty>
              </>
            )}
          </div>
        </Section>
      </Wrap>
    </div>
  );
}
