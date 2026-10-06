import type { Metadata } from "next";
import { Empty, Heading, Placeholder, Section, Wrap } from "@/components/blocks";
import { Diverging, FactorTable, ShotHeatmap, ZoneRows } from "@/components/charts/html";
import { DefRatingChart } from "@/components/charts/recharts";
import { Hero, KpiRow } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { one, ordinal, parseSeason, pct, seasonOptions, signed } from "@/lib/format";
import { DEF_FACTOR_META, defFactorsHeadline, defPlayersHeadline, defRolling, defTrendHeadline, defZonesHeadline } from "@/lib/insights";
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
  const d = await pageData<DefenseData>("defense", [parseSeason(sp.season), mine?.abbr ?? null, opp]);
  const t = d.team;
  if (!t) return <Wrap className="py-20"><Empty>No games for this team and season yet.</Empty></Wrap>;

  const series = defRolling(d.games);
  const f = d.factors;
  const change = t.prev_drtg !== null ? t.drtg - t.prev_drtg : null;

  const chosen = d.opponent;
  const chosenGames = chosen ? d.opponents.find((o) => o[0] === chosen)?.[1] ?? 0 : t.gp;
  const who = chosen ?? "Opponents";
  const cmpLabel = chosen ? "their usual rate" : "the league average";
  const oppOptions = [
    { value: "all", label: "All opponents" },
    ...d.opponents.map(([abbr, g]) => ({ value: abbr, label: `${abbr} · ${g} game${g === 1 ? "" : "s"}` })),
  ];

  const spread = Math.max(1, ...d.ranking.map(([, r]) => Math.abs(d.leagueDrtg - r)));

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
          <Heading title={defTrendHeadline(t.abbr, series, d.leagueDrtg)} caption="Defensive rating over the last 10 games, game by game. Lower is better. The dashed line is the league average." />
          {series.length >= 2 ? (
            <DefRatingChart data={series} league={d.leagueDrtg} />
          ) : (
            <Empty>The 10-game trend starts after game 10.</Empty>
          )}
        </Section>

        <Section className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-5">
            {f ? (
              <>
                <Heading size="md" title={defFactorsHeadline(f)} caption="The four things a defense controls. Rank 1 is the best defense in each." />
                <FactorTable
                  abbr={t.abbr}
                  meta={DEF_FACTOR_META}
                  team={f}
                  league={d.leagueFactors}
                  ranks={{ opp_efg: f.opp_efg_rank, forced_tov: f.forced_tov_rank, dreb: f.dreb_rank, opp_ftr: f.opp_ftr_rank }}
                />
              </>
            ) : null}
          </div>
          <div className="flex flex-col gap-5">
            <Heading
              size="md"
              title={`${ordinal(t.def_rank)} of 30. ${t.def_rank === 1 ? `${(d.ranking[1][1] - t.drtg).toFixed(1)} clear of ${d.ranking[1][0]}.` : `${(t.drtg - d.ranking[0][1]).toFixed(1)} behind ${d.ranking[0][0]}.`}`}
              caption="Defensive rating against the league average. Bars to the right are better."
            />
            <Diverging
              labelWidth={52}
              noteWidth={0}
              leftLabel="← Worse"
              rightLabel="Better →"
              max={spread}
              rows={d.ranking.map(([abbr, r]) => ({
                key: abbr,
                label: abbr,
                value: d.leagueDrtg - r,
                valueText: r.toFixed(1),
                tone: abbr === t.abbr ? "accent" : "ink",
              }))}
            />
          </div>
        </Section>

        <Section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-[880px] flex-1">
              <Heading
                title={defZonesHeadline(d.zones, d.compareZones, who, cmpLabel)}
                caption={`Where ${chosen ? `${chosen} shoot` : "opponents shoot"} against ${t.abbr}: ${d.shotCount.toLocaleString()} shots over ${chosenGames} game${chosenGames === 1 ? "" : "s"}. Brighter means more shots.${chosen ? " One opponent is a small sample, so treat gaps as signals." : ""}`}
              />
            </div>
            <ParamSelect name="opp" label="Opponent" value={chosen ?? "all"} options={oppOptions} />
          </div>
          {d.shotCount ? (
            <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
              <div className="border border-line"><ShotHeatmap bins={d.bins} /></div>
              <ZoneRows zones={d.zones} compare={d.compareZones} abbr={chosen ?? "Opp"} compareLabel={chosen ? "Usual" : "League"} />
            </div>
          ) : (
            <Empty>No shot locations for this season. Shot charts cover 2024-25 onward.</Empty>
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
          <div className="grid gap-4 md:grid-cols-2">
            <Placeholder title="On/off defensive impact" need="Points allowed per 100 with each player on the court against off it. Loads in phase 2." />
            <Placeholder title="Defended shooting" need="Opponent FG% when he is the closest defender, against what those shooters usually hit. Loads in phase 2." />
          </div>
        </Section>
      </Wrap>
    </div>
  );
}
