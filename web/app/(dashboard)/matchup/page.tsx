import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { ChartCard } from "@/components/chart-card";
import { ZoneRows } from "@/components/charts/html";
import { HorizontalBarChart, PairedHorizontalBarChart } from "@/components/charts/recharts";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { dec3, one, ordinal, parseSeason, seasonOptions, shortDate, signed } from "@/lib/format";
import { FACTOR_META, cap, zoneName } from "@/lib/insights";
import { myTeam } from "@/lib/my-team";
import { colorDistance, onColor, opponentColor, teamColor, teamTheme } from "@/lib/teams";
import type { MatchupData, TeamRow } from "@/lib/types";

export const metadata: Metadata = { title: "Matchup Scout" };
export const revalidate = 3600;

function Side({ t, bg, clutch }: { t: TeamRow; bg: string; clutch?: { w: number; l: number; net: number | null; net_rank: number } }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-10 pt-8 md:px-12" style={{ background: bg, color: onColor(bg) }}>
      <span className="display display-tight text-[clamp(96px,12vw,150px)]">{t.abbr}</span>
      <span className="display text-[28px] font-extrabold tracking-[0.04em]">{t.name} · {t.w}-{t.l}</span>
      <div className="grid grid-cols-3 gap-3 border-t border-current pt-3">
        {[["Net", signed(t.net)], ["Offense", t.ortg.toFixed(1)], ["Defense", t.drtg.toFixed(1)]].map(([l, v]) => (
          <div key={l} className="flex flex-col"><span className="label">{l}</span><span className="display text-[clamp(40px,4.5vw,60px)]">{v}</span></div>
        ))}
      </div>
      <span className="font-mono text-[13px]">
        PACE {t.pace.toFixed(1)}
        {clutch ? ` · CLUTCH ${clutch.w}-${clutch.l}, NET ${clutch.net === null ? "-" : signed(clutch.net)} (${ordinal(clutch.net_rank)})` : ""}
      </span>
    </div>
  );
}

export default async function MatchupScout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mine = await myTeam();
  const season = parseSeason(sp.season);
  // Team A is always the team picked on the landing page. Only team B can change.
  const teamA = mine?.abbr ?? null;
  let teamB = one(sp.b)?.toUpperCase() ?? null;
  if (teamB === teamA) teamB = null;
  if (!teamB) {
    // Default opponent: the net rating leader, or the runner-up when we are the leader
    const lead = await pageData<MatchupData>("matchup", [season, null, null]);
    teamB = (lead.a && lead.a.abbr !== teamA ? lead.a : lead.b)?.abbr ?? null;
  }
  const d = await pageData<MatchupData>("matchup", [season, teamA, teamB]);
  const { a, b } = d;
  if (!a || !b) return <Wrap className="py-20"><Empty>Pick two teams with games this season.</Empty></Wrap>;

  // Team B can be any team except our own
  const opts = d.teams.filter((t) => t.abbr !== a.abbr).map((t) => ({ value: t.abbr, label: t.abbr }));
  const aWins = d.games.filter((g) => g.a_pts > g.b_pts).length;
  const bWins = d.games.length - aWins;
  const better = a.net >= b.net ? a : b;
  const leader = aWins >= bWins ? a : b;
  const h2hTitle = !d.games.length
    ? `${a.abbr} and ${b.abbr} have not met yet this season.`
    : `${leader.abbr} won ${Math.max(aWins, bWins)} of the ${d.games.length} games between them${leader.abbr !== better.abbr && aWins !== bWins ? ", despite the worse ratings" : ""}.`;

  const fa = d.factors?.[a.abbr], fb = d.factors?.[b.abbr];
  let factorTitle = "";
  if (fa && fb) {
    const gaps = FACTOR_META.map((m) => {
      const diff = (fa[m.key] - fb[m.key]) * (m.lowerIsBetter ? -1 : 1);
      return { m, diff, size: Math.abs(fa[m.key] - fb[m.key]) / ((fa[m.key] + fb[m.key]) / 2) };
    }).sort((x, y) => y.size - x.size);
    const g = gaps[0];
    const edge = g.diff >= 0 ? a.abbr : b.abbr;
    factorTitle = `${cap(g.m.short)} decides this matchup: ${edge} holds the edge, ${dec3(Math.max(fa[g.m.key], fb[g.m.key]))} against ${dec3(Math.min(fa[g.m.key], fb[g.m.key]))}.`;
  }

  const za = d.zones.filter((z) => z.abbr === a.abbr);
  const zb = d.zones.filter((z) => z.abbr === b.abbr);
  const zbMap = new Map(zb.map((z) => [z.zone, z]));
  const zoneGap = za
    .filter((z) => zbMap.has(z.zone))
    .map((z) => ({ zone: z.zone, diff: zbMap.get(z.zone)!.share - z.share }))
    .sort((x, y) => y.diff - x.diff)[0];

  // The opponent gets its own team colour, picked so it stays distinct from ours
  const opp = opponentColor(a.abbr, b.abbr);
  // Hero panels use each team's main colour, unless the two would look alike side by side
  const bPanel = colorDistance(teamColor(a.abbr), teamColor(b.abbr)) > 110 ? teamColor(b.abbr) : opp;

  return (
    <div style={{ ...teamTheme(a.abbr), "--opp": opp } as React.CSSProperties}>
      <section>
        <div className="flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-3 text-white">
          <span className="label">Matchup Scout · {d.seasonLabel}</span>
          <span className="label border-2 border-current px-3 py-2">Your team · {a.abbr}</span>
          <ParamSelect name="b" label="Opponent" value={b.abbr} options={opts} />
          <ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />
        </div>
        <div className="grid md:grid-cols-2">
          <Side t={a} bg={teamColor(a.abbr)} clutch={d.clutch?.[a.abbr]} />
          <Side t={b} bg={bPanel} clutch={d.clutch?.[b.abbr]} />
        </div>
      </section>

      <Wrap>
        <Section className="flex flex-col gap-6">
          {d.games.length ? (
            <ChartCard title={h2hTitle} description={`${a.abbr} margin in every ${d.seasonLabel} game against ${b.abbr}, regular season and playoffs`}
              legend={[
                { label: `${a.abbr} won`, color: "var(--accent)" },
                { label: `${b.abbr} won`, color: "var(--opp)" },
              ]}
              note={`Right of the line: ${a.abbr} won. Left: ${b.abbr} won. The number is the final score.`}>
              <HorizontalBarChart
                name="Score" icon="scale" refLine={0} categoryWidth={72}
                domain={(() => { const m = Math.max(15, ...d.games.map((g) => Math.abs(g.a_pts - g.b_pts))); return [-m, m] as [number, number]; })()}
                data={d.games.map((g) => {
                  const m = g.a_pts - g.b_pts;
                  return {
                    key: `${g.game_date}-${g.phase}`, label: shortDate(g.game_date), value: m, valueText: `${g.a_pts}-${g.b_pts}`,
                    fill: m >= 0 ? "var(--accent)" : "var(--opp)",
                    tips: [
                      { label: "Game", value: g.phase === "Playoffs" ? "Playoffs" : "Regular season", icon: "calendar" as const },
                      { label: `${a.abbr} played`, value: g.a_home ? "Home" : "Away", icon: "house" as const },
                    ],
                  };
                })}
              />
            </ChartCard>
          ) : (
            <Heading title={h2hTitle} />
          )}
        </Section>

        {/* Two equal cards side by side */}
        <Section className="grid items-stretch gap-6 lg:grid-cols-2">
          <div className="flex flex-col">
            {fa && fb ? (
              <ChartCard className="h-full" title={factorTitle} description="Offense, four factors, regular season"
                legend={[{ label: a.abbr, color: "var(--accent)" }, { label: b.abbr, color: "var(--opp)" }]}
                note="Bars are scaled per factor. Lower is better for turnovers.">
                <PairedHorizontalBarChart
                  a={a.abbr} b={b.abbr}
                  data={FACTOR_META.map((m) => ({
                    key: m.key, label: m.label.replace(/ \(.*\)$/, ""), a: fa[m.key], b: fb[m.key], aText: dec3(fa[m.key]), bText: dec3(fb[m.key]),
                    // Typical league highs, so each factor's bars use a sensible length
                    scale: { efg: 0.62, tov: 0.16, orb: 0.34, ftr: 0.28 }[m.key],
                  }))}
                />
              </ChartCard>
            ) : null}
          </div>
          <ChartCard
            className="h-full"
            title={zoneGap && zoneGap.diff > 0.01 ? `${b.abbr} takes more ${zoneName(zoneGap.zone).toLowerCase()} than ${a.abbr}. Defend that zone.` : `${a.abbr} and ${b.abbr} shoot from similar spots.`}
            description={`${a.abbr} shot share and make rate by zone, with ${b.abbr} for comparison.`}
          >
            <ZoneRows zones={za} compare={zb} abbr={a.abbr} compareLabel={b.abbr} />
          </ChartCard>
        </Section>
      </Wrap>
    </div>
  );
}
