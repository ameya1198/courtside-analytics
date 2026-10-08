import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { ChartCard } from "@/components/chart-card";
import { DivergingBar, FactorTable, Legend, ShotHeatmap, ZoneRows } from "@/components/charts/html";
import { DefRatingChart, HorizontalBarChart } from "@/components/charts/recharts";
import { Hero, KpiRow } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { one, ordinal, parseSeason, pct, seasonOptions, signed } from "@/lib/format";
import {
  DEF_FACTOR_META, MISC_META, defFactorsHeadline, defImpactHeadline, defMiscHeadline, defPlayersHeadline, defRolling,
  defTrendHeadline, defZonesHeadline, dfgPoints, impactRanking, money,
} from "@/lib/insights";
import { myTeam } from "@/lib/my-team";
import { logoUrl, teamTheme } from "@/lib/teams";
import type { DefenseData } from "@/lib/types";

export const metadata: Metadata = { title: "Defense" };
export const revalidate = 3600;

export default async function Defense({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mine = await myTeam();
  const oppParam = one(sp.opp);
  const opp = oppParam && /^[A-Za-z]{3}$/.test(oppParam) ? oppParam.toUpperCase() : null;
  // Shot section game type: ?type=regular or ?type=playoffs, both by default
  const typeParam = one(sp.type);
  const shotType = typeParam === "regular" ? "Regular Season" : typeParam === "playoffs" ? "Playoffs" : null;
  const d = await pageData<DefenseData>("defense", [parseSeason(sp.season), mine?.abbr ?? null, opp, shotType]);
  const t = d.team;
  if (!t) return <Wrap className="py-20"><Empty>No games for this team and season yet.</Empty></Wrap>;

  const series = defRolling(d.games);
  const f = d.factors;
  const change = t.prev_drtg !== null ? t.drtg - t.prev_drtg : null;

  const chosen = d.opponent;
  const chosenGames = chosen ? d.opponents.find((o) => o[0] === chosen)?.[1] ?? 0 : d.shotGames ?? t.gp;
  const label = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  const shotScope = `${d.shotSeasons ? `${label(d.shotSeasons[0])} and ${label(d.shotSeasons[1])}` : d.seasonLabel}, ${
    shotType === "Regular Season" ? "regular season" : shotType === "Playoffs" ? "playoffs" : "regular season and playoffs"}`;
  const typeOptions = [
    { value: "both", label: "Regular season and playoffs" },
    { value: "regular", label: "Regular season" },
    { value: "playoffs", label: "Playoffs" },
  ];
  const who = chosen ?? "Opponents";
  const cmpLabel = chosen ? "their usual rate" : "the league average";
  const oppOptions = [
    { value: "all", label: "All opponents" },
    ...d.opponents.map(([abbr, g]) => ({ value: abbr, label: `${abbr} · ${g} game${g === 1 ? "" : "s"}` })),
  ];

  const spread = Math.max(1, ...d.ranking.map(([, r]) => Math.abs(d.leagueDrtg - r)));
  const impact = impactRanking(d.players);
  const impactMax = Math.max(4, ...impact.map((p) => Math.abs(p.onoff_drtg!)));
  const misc = d.misc ?? null;

  return (
    <div style={teamTheme(t.abbr)}>
      <Hero
        eyebrow={`Defense · ${d.seasonLabel} · points allowed per 100 possessions`}
        title={t.name}
        watermark={{ src: logoUrl(t.team_id), alt: `${t.name} logo` }}
        controls={<ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />}
      >
        <KpiRow
          items={[
            { label: "Defensive rating", value: t.drtg.toFixed(1), note: `${ordinal(t.def_rank)} of 30. League ${d.leagueDrtg}` },
            { label: "Points allowed", value: t.opp_ppg.toFixed(1), note: "per game" },
            { label: "Opponent eFG%", value: f ? pct(f.opp_efg) : "-", note: f ? `${ordinal(f.opp_efg_rank)} lowest` : undefined },
            {
              label: "vs last season",
              value: change === null ? "-" : signed(change),
              note: change === null ? "No prior season" : `${change <= 0 ? "Better" : "Worse"}. Was ${ordinal(t.prev_rank!)}`,
            },
          ]}
        />
      </Hero>

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading title={defTrendHeadline(t.abbr, series, d.leagueDrtg)} caption="Defensive rating over the last 10 games, game by game. Lower is better." />
          <Legend items={[
            { label: "10-game defensive rating", color: "var(--accent)", kind: "line" },
            { label: "League average", color: "var(--panel-muted)", kind: "dashed" },
            { label: "Best stretch", color: "var(--ink)", kind: "dot" },
            { label: "Worst stretch", color: "var(--warn)", kind: "dot" },
          ]} />
          {series.length >= 2 ? (
            <DefRatingChart data={series} league={d.leagueDrtg} />
          ) : (
            <Empty>The 10-game trend starts after game 10.</Empty>
          )}
        </Section>

        {/* Two equal cards side by side */}
        <Section className="grid items-stretch gap-6 lg:grid-cols-2">
          {f ? (
            <ChartCard className="h-full" title={defFactorsHeadline(f)} description="The four things a defense controls. Rank 1 is the best defense in each.">
              <FactorTable
                abbr={t.abbr}
                meta={DEF_FACTOR_META}
                team={f}
                league={d.leagueFactors}
                ranks={{ opp_efg: f.opp_efg_rank, forced_tov: f.forced_tov_rank, dreb: f.dreb_rank, opp_ftr: f.opp_ftr_rank }}
              />
            </ChartCard>
          ) : <div />}
          <div className="flex flex-col">
            <ChartCard
              className="h-full"
              title={`${ordinal(t.def_rank)} of 30. ${t.def_rank === 1 ? `${(d.ranking[1][1] - t.drtg).toFixed(1)} clear of ${d.ranking[1][0]}.` : `${(t.drtg - d.ranking[0][1]).toFixed(1)} behind ${d.ranking[0][0]}.`}`}
              description="Defensive rating against the league average"
              legend={[
                { label: t.abbr, color: "var(--accent)" },
                { label: "Other teams", color: "var(--ink)" },
                { label: "League average", color: "var(--panel-muted)", kind: "dashed" },
              ]}
              note="Bars to the right are better. The number is points allowed per 100 possessions. Scroll for all 30 teams."
            >
              <HorizontalBarChart
                name="Defensive rating" icon="scale" refLine={0} domain={[-spread, spread]} categoryWidth={52} rowHeight={32} labelSize={18} maxHeight={420} focusKey={t.abbr}
                data={d.ranking.map(([abbr, r]) => ({
                  key: abbr, label: abbr, value: d.leagueDrtg - r, valueText: r.toFixed(1),
                  fill: abbr === t.abbr ? "var(--accent)" : "var(--ink)",
                  tips: [{ label: "Against league", value: signed(d.leagueDrtg - r), icon: "trending-up" as const }],
                }))}
              />
            </ChartCard>
          </div>
        </Section>

        <Section className="flex flex-col gap-6">
          {/* Heading across the full width, filters on their own line under it */}
          <div className="flex flex-col gap-4">
            <div>
              <Heading
                title={defZonesHeadline(d.zones, d.compareZones, who, cmpLabel)}
                caption={`Where ${chosen ? `${chosen} shoot` : "opponents shoot"} against ${t.abbr}: ${d.shotCount.toLocaleString()} shots over ${chosenGames} game${chosenGames === 1 ? "" : "s"} in ${shotScope}. Red means more shots, blue fewer.${chosen ? " One opponent is a small sample, so treat gaps as signals." : ""}`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ParamSelect name="type" label="Games" value={typeParam === "regular" || typeParam === "playoffs" ? typeParam : "both"} options={typeOptions} />
              <ParamSelect name="opp" label="Opponent" value={chosen ?? "all"} options={oppOptions} />
            </div>
          </div>
          {d.shotCount ? (
            <div className="grid items-stretch gap-12 lg:grid-cols-[1fr_1.1fr]">
              {/* The court box stretches to the zone table's height, with the court centred in it */}
              <div className="flex items-center border border-line"><div className="w-full"><ShotHeatmap bins={d.bins} /></div></div>
              <ZoneRows zones={d.zones} compare={d.compareZones} abbr={chosen ?? "Opp"} compareLabel={chosen ? "Usual" : "League"} />
            </div>
          ) : (
            <Empty>No shot locations for these games. Shot charts cover 2022-23 onward.</Empty>
          )}
        </Section>

        <Section className="flex flex-col gap-6">
          <Heading
            title={defPlayersHeadline(d.players)}
            caption="Box-score defense per 36 minutes, rotation players (10+ games, 12+ minutes a game). Steals and blocks miss most good defense, so read this with the on/off numbers once they load."
          />
          {d.players.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="label grid grid-cols-[minmax(200px,1.6fr)_repeat(6,minmax(64px,1fr))] gap-3 border-b-[3px] border-ink pb-2 text-muted">
                  <span>Player</span>
                  <span className="text-right">MPG</span><span className="text-right">STL/36</span><span className="text-right">BLK/36</span>
                  <span className="text-right">DREB/36</span><span className="text-right">Fouls/36</span><span className="text-right">+/- a game</span>
                </div>
                {(() => {
                  const top = (k: "stl36" | "blk36" | "dreb36") => Math.max(...d.players.map((p) => p[k]));
                  const tops = { stl36: top("stl36"), blk36: top("blk36"), dreb36: top("dreb36") };
                  const maxPf = Math.max(...d.players.map((p) => p.pf36));
                  const cell = (v: string, hi: boolean, warn = false) => (
                    <span className={`text-right font-mono text-[15px] ${hi ? "font-bold" : ""}`} style={{ color: hi ? (warn ? "var(--warn)" : "var(--accent)") : undefined }}>{v}</span>
                  );
                  return d.players.map((p) => (
                    <div key={p.player_id} className="row-hover grid grid-cols-[minmax(200px,1.6fr)_repeat(6,minmax(64px,1fr))] items-center gap-3 border-b border-line py-3">
                      <a href={`/player?player=${p.player_id}&season=${d.season}`} className="display truncate text-[22px] font-extrabold tracking-[0.02em] hover:underline">{p.name}</a>
                      {cell(p.mpg.toFixed(1), false)}
                      {cell(p.stl36.toFixed(1), p.stl36 === tops.stl36)}
                      {cell(p.blk36.toFixed(1), p.blk36 === tops.blk36)}
                      {cell(p.dreb36.toFixed(1), p.dreb36 === tops.dreb36)}
                      {cell(p.pf36.toFixed(1), p.pf36 === maxPf, true)}
                      {cell(signed(p.pm), false)}
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <Empty>No rotation players yet this season.</Empty>
          )}
        </Section>

        {/* Defensive impact: on/off and defended shooting for qualified players */}
        <Section className="flex flex-col gap-6">
          <Heading
            title={defImpactHeadline(d.players, t.name)}
            caption="On/off is the points the team allows per 100 possessions with him off the court, minus with him on. Positive means the team defends better when he plays. Defended FG% is how opponents shoot when he is the closest defender, against what those shooters usually hit. Negative is good. Players with 500+ minutes and 20+ games. On/off depends on who he plays with, so treat it as a signal, not proof."
          />
          <Legend items={[
            { label: "Good: team defends better with him on, opponents shoot worse", color: "var(--accent)" },
            { label: "Bad: team defends worse with him on, opponents shoot better", color: "var(--warn)" },
          ]} />
          {impact.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="label grid grid-cols-[minmax(180px,1.4fr)_minmax(150px,1.3fr)_repeat(6,minmax(70px,1fr))] gap-3 border-b-[3px] border-ink pb-2 text-muted">
                  <span>Player</span><span>On/off, per 100</span>
                  <span className="text-right">Defended FG%</span><span className="text-right">At the rim</span><span className="text-right">On threes</span>
                  <span className="text-right">Contests/36</span><span className="text-right">Deflections/36</span><span className="text-right">Salary</span>
                </div>
                {impact.map((p) => {
                  const diff = (v: number | null | undefined) => (v === null || v === undefined ? (
                    <span className="text-right font-mono text-[15px] text-muted">-</span>
                  ) : (
                    <span className="text-right font-mono text-[15px]" style={{ color: v < 0 ? "var(--accent)" : "var(--warn)" }}>{dfgPoints(v)}</span>
                  ));
                  return (
                    <div key={p.player_id} className="row-hover grid grid-cols-[minmax(180px,1.4fr)_minmax(150px,1.3fr)_repeat(6,minmax(70px,1fr))] items-center gap-3 border-b border-line py-3">
                      <a href={`/player?player=${p.player_id}&season=${d.season}`} className="display truncate text-[22px] font-extrabold tracking-[0.02em] hover:underline">{p.name}</a>
                      <div className="grid grid-cols-[minmax(0,1fr)_52px] items-center gap-2">
                        <DivergingBar value={p.onoff_drtg!} max={impactMax} tone={p.onoff_drtg! >= 0 ? "accent" : "warn"} />
                        <span className="text-right font-mono text-[15px] font-medium">{signed(p.onoff_drtg!)}</span>
                      </div>
                      {diff(p.dfg_diff)}
                      {diff(p.dfg_diff_rim)}
                      {diff(p.dfg_diff_three)}
                      <span className="text-right font-mono text-[15px]">{p.contests36?.toFixed(1) ?? "-"}</span>
                      <span className="text-right font-mono text-[15px]">{p.deflections36?.toFixed(1) ?? "-"}</span>
                      <span className="text-right font-mono text-[15px]">{p.salary ? money(p.salary) : "-"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Empty>No player has 500 minutes and 20 games for {t.abbr} yet this season.</Empty>
          )}
          {impact.length ? (
            <span className="text-[13px] text-muted">
              Shooting columns are percentage points against the shooters&apos; usual rate. Negative numbers, in the team colour, mean opponents shot worse than usual. Defended shooting covers his whole season, including games for another team.
            </span>
          ) : null}
        </Section>

        {/* Where opponents score */}
        {misc ? (
          <Section className="flex flex-col gap-6">
            <Heading
              title={defMiscHeadline(misc, t.abbr)}
              caption="Points opponents score per game four ways, with the league rank. Rank 1 allows the fewest."
            />
            <Legend items={[
              { label: "Top 5 in the league", color: "var(--accent)" },
              { label: "Bottom 10", color: "var(--warn)" },
              { label: "In between", color: "var(--ink)" },
            ]} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MISC_META.map((m) => {
                const value = misc[m.key];
                const rank = misc[`${m.key}_rank`];
                const tone = rank <= 5 ? "var(--accent)" : rank >= 21 ? "var(--warn)" : "var(--ink)";
                return (
                  <div key={m.key} className="flex flex-col gap-1 border border-line p-4" style={{ borderTop: `4px solid ${tone}` }}>
                    <span className="label">{m.label}</span>
                    <span className="display text-[56px] leading-none" style={{ color: tone }}>{value.toFixed(1)}</span>
                    <span className="font-mono text-[13px]">{ordinal(rank)} of 30 · league {misc.league[m.key].toFixed(1)}</span>
                    <span className="text-[13px] text-muted">Per game, {m.hint}.</span>
                  </div>
                );
              })}
            </div>
          </Section>
        ) : null}
      </Wrap>
    </div>
  );
}
