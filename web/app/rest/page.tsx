import type { Metadata } from "next";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { Diverging, MonthHeatmap } from "@/components/charts/html";
import { RestBucketsChart } from "@/components/charts/recharts";
import { Hero } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { myTeam } from "@/lib/my-team";
import { ordinal, parseSeason, seasonOptions, signed } from "@/lib/format";
import { teamTheme } from "@/lib/teams";
import type { RestData } from "@/lib/types";

export const metadata: Metadata = { title: "Rest and Schedule" };
export const revalidate = 3600;

const seasonLabel = (s: number) => `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default async function RestSchedule({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mine = await myTeam();
  if (!mine) return <Wrap className="py-20"><Empty>Pick a team first.</Empty></Wrap>;
  const d = await pageData<RestData>("rest", [parseSeason(sp.season), mine.abbr]);

  const b2b = d.buckets.find((b) => b.rest === 0);
  const oneDay = d.buckets.find((b) => b.rest === 1);
  const gapSeasons = `${seasonLabel(d.historyFrom)} to ${seasonLabel(d.historyTo)}`;

  // Win rate gap (rested minus second night of a back-to-back), in points, for every team with enough games
  const gaps = d.gaps
    .filter((g) => g.b2b_pct !== null && g.rested_pct !== null && g.b2b_games >= 8)
    .map((g) => ({ ...g, gap: (g.rested_pct! - g.b2b_pct!) * 100 }))
    .sort((a, b) => b.gap - a.gap);
  const mineGap = gaps.find((g) => g.abbr === mine.abbr);
  const rank = mineGap ? gaps.indexOf(mineGap) + 1 : null;
  const avg = (f: (g: (typeof gaps)[number]) => number) => (gaps.length ? gaps.reduce((s, g) => s + f(g), 0) / gaps.length : 0);
  const leagueGap = avg((g) => g.gap);

  const months = d.months.filter((m) => m[0] === mine.abbr);
  const b2bTotal = months.reduce((s, m) => s + m[2], 0);

  return (
    <div style={teamTheme(mine.abbr)}>
      <Hero
        eyebrow={`${mine.city} ${mine.name} · Win rate on the second night of a back-to-back`}
        title={b2b ? pct(b2b.win_pct) : "No data"}
        controls={<ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />}
        side={
          b2b ? (
            <div className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-1 border-t-[3px] border-current pb-16 pt-4">
              <span className="display display-tight text-[84px]">{signed(b2b.margin)}</span>
              <span className="text-[17px]">
                points of margin per game against a rested opponent, across {b2b.games.toLocaleString()} games from {gapSeasons}.
                {b2b.league_win_pct !== undefined ? ` The league wins ${pct(b2b.league_win_pct)} in the same spot.` : ""}
              </span>
            </div>
          ) : null
        }
      />

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading
            title={b2b && oneDay ? `${mine.name} win ${pct(b2b.win_pct)} on the second night and ${pct(oneDay.win_pct)} with one day of rest.` : `How rest changes ${mine.name} results.`}
            caption={`Win rate by days of rest, against an opponent with at least one day off, ${gapSeasons}. Hover a bar for the league win rate.`}
          />
          <div className="panel px-4 pb-4 pt-4 md:px-7">
            <RestBucketsChart
              data={d.buckets.map((b) => ({
                label: b.rest === 0 ? "Back-to-back" : b.rest === 1 ? "1 day of rest" : b.rest === 2 ? "2 days" : "3+ days",
                win: Math.round(b.win_pct * 1000) / 10, margin: b.margin, games: b.games,
                league: b.league_win_pct === undefined ? undefined : Math.round(b.league_win_pct * 1000) / 10,
              }))}
            />
          </div>
        </Section>

        <Section className="grid items-start gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-5">
            <Heading
              size="md"
              title={
                mineGap && rank
                  ? mineGap.gap >= 0
                    ? `${mine.name} win ${Math.round(mineGap.gap)} points less often on the second night. ${ordinal(rank)} biggest drop of ${gaps.length} teams.`
                    : `${mine.name} win ${Math.round(-mineGap.gap)} points more often on the second night. ${ordinal(rank)} biggest drop of ${gaps.length} teams.`
                  : "Back-to-back records will show once the team has played some."
              }
              caption={`Win rate when rested minus win rate on a back-to-back, in percentage points, ${gapSeasons}. A single team's gap is a signal, not proof.`}
            />
            {mineGap ? (
              <Diverging
                leftLabel="← Better on B2B"
                rightLabel="Worse on B2B →"
                max={Math.max(10, Math.abs(mineGap.gap), Math.abs(leagueGap))}
                noteWidth={110}
                rows={[
                  {
                    key: mine.abbr, label: mine.abbr, value: mineGap.gap, valueText: signed(mineGap.gap),
                    note: `${Math.round(mineGap.b2b_pct! * 100)}% vs ${Math.round(mineGap.rested_pct! * 100)}%`,
                    tone: mineGap.gap >= 0 ? "warn" : "accent",
                  },
                  {
                    key: "league", label: "LGE", value: leagueGap, valueText: signed(leagueGap),
                    note: `${Math.round(avg((g) => g.b2b_pct!) * 100)}% vs ${Math.round(avg((g) => g.rested_pct!) * 100)}%`,
                    tone: "ink",
                  },
                ]}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-5">
            <Heading
              size="md"
              title={b2bTotal ? `${mine.name} play ${b2bTotal} back-to-back${b2bTotal === 1 ? "" : "s"} in ${d.seasonLabel}.` : `No back-to-backs for ${mine.name} yet this season.`}
              caption="Back-to-backs by month. Darker means more. Plan rest days around the dark cells."
            />
            <MonthHeatmap months={months} />
          </div>
        </Section>
      </Wrap>
    </div>
  );
}
