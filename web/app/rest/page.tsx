import type { Metadata } from "next";
import { Heading, Section, Wrap } from "@/components/blocks";
import { Diverging, MonthHeatmap } from "@/components/charts/html";
import { RestBucketsChart } from "@/components/charts/recharts";
import { Hero } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { parseSeason, seasonOptions, signed } from "@/lib/format";
import { restHeadlines } from "@/lib/insights";
import { teamTheme } from "@/lib/teams";
import type { RestData } from "@/lib/types";

export const metadata: Metadata = { title: "Rest and Schedule" };
export const revalidate = 3600;

const seasonLabel = (s: number) => `${s}-${String((s + 1) % 100).padStart(2, "0")}`;

export default async function RestSchedule({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await pageData<RestData>("rest", [parseSeason(sp.season)]);
  const h = restHeadlines(d);
  const b2b = h.b2b;
  const rested = d.buckets.filter((b) => b.rest > 0);
  const restedMax = rested.length ? Math.max(...rested.map((b) => Math.abs(b.margin))) : 0;
  const totals = new Map<string, number>();
  for (const [t, , n] of d.months) totals.set(t, (totals.get(t) ?? 0) + n);
  const sortedTotals = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const most = sortedTotals.filter(([, n]) => n === sortedTotals[0]?.[1]).map(([t]) => t);
  const fewestN = sortedTotals[sortedTotals.length - 1]?.[1];
  const fewest = sortedTotals.filter(([, n]) => n === fewestN).map(([t]) => t);
  const gapSeasons = `${seasonLabel(d.season - 2)} to ${d.seasonLabel}`;

  return (
    <div style={teamTheme(null)}>
      <Hero
        eyebrow="Rest and Schedule · Win rate on the second night of a back-to-back"
        title={b2b ? `${(b2b.win_pct * 100).toFixed(1)}%` : "No data"}
        controls={<ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />}
        side={
          b2b ? (
            <div className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-1 border-t-[3px] border-current pb-12 pt-4">
              <span className="display text-[84px]">{signed(b2b.margin)}</span>
              <span className="text-[17px]">points of margin per game against a rested opponent, across {b2b.games.toLocaleString()} games from {seasonLabel(d.historyFrom)} to {seasonLabel(d.historyTo)}.</span>
            </div>
          ) : null
        }
      />

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading
            title="One day of rest erases the penalty. Protect the second night."
            caption={`Win rate by days of rest, against an opponent with at least one day off. With rest, the margin stays within ${restedMax.toFixed(2)} points of zero.`}
          />
          <div className="panel px-4 pb-4 pt-4 md:px-7">
            <RestBucketsChart
              data={d.buckets.map((b) => ({
                label: b.rest === 0 ? "Back-to-back" : b.rest === 1 ? "1 day of rest" : b.rest === 2 ? "2 days" : "3+ days",
                win: Math.round(b.win_pct * 1000) / 10, margin: b.margin, games: b.games,
              }))}
            />
          </div>
        </Section>

        <Section className="grid items-start gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-5">
            <Heading size="md" title={h.gapTitle} caption={`Win rate when rested minus win rate on a back-to-back, in percentage points, ${gapSeasons}. About 40 back-to-backs per team, so treat single-team gaps as signals, not proof.`} />
            <Diverging
              leftLabel="← Better on B2B"
              rightLabel="Worse on B2B →"
              max={Math.max(10, ...h.gaps.map((g) => Math.abs(g.gap)))}
              noteWidth={110}
              rows={h.gaps.map((g) => ({
                key: g.abbr, label: g.abbr, value: g.gap, valueText: signed(g.gap),
                note: `${Math.round(g.b2b_pct! * 100)}% vs ${Math.round(g.rested_pct! * 100)}%`,
                tone: g.gap >= 0 ? "warn" : "accent",
              }))}
            />
          </div>
          <div className="flex flex-col gap-5">
            <Heading
              size="md"
              title={most.length ? `${most.join(" and ")} played ${sortedTotals[0][1]} back-to-backs in ${d.seasonLabel}. ${fewest.length} ${fewest.length === 1 ? "team" : "teams"} played ${fewestN}.` : "No back-to-backs yet this season."}
              caption="Back-to-backs per team by month. Darker means more. Plan rest days around the dark cells."
            />
            <MonthHeatmap months={d.months} />
          </div>
        </Section>
      </Wrap>
    </div>
  );
}
