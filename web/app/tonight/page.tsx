import type { Metadata } from "next";
import { ChartCard } from "@/components/chart-card";
import { Legend } from "@/components/charts/html";
import { HorizontalBarChart } from "@/components/charts/recharts";
import { Empty, Heading, Notice, Section, Wrap } from "@/components/blocks";
import { Hero } from "@/components/hero";
import { pageData } from "@/lib/db";
import { longDate, one, signed } from "@/lib/format";
import { myTeam } from "@/lib/my-team";
import { teamTheme } from "@/lib/teams";
import type { TonightData, TonightGame } from "@/lib/types";

export const metadata: Metadata = { title: "Tonight" };
export const revalidate = 900;

const tipTime = (utc: string | null) =>
  utc
    ? new Date(utc).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"
    : "";

const restLabel = (days: number | null, b2b: boolean) =>
  b2b ? "B2B" : days === null ? "1st game" : `${days}d rest`;

function GameCard({ g, mine }: { g: TonightGame; mine?: string }) {
  const played = g.final && g.homePts !== null && g.awayPts !== null;
  const homeWon = played && g.homePts! > g.awayPts!;
  const row = (abbr: string, pts: number | null, net: number | null, rest: number | null, b2b: boolean, won: boolean, home: boolean) => (
    <div className={`grid grid-cols-[76px_minmax(0,1fr)_80px] items-center gap-3 px-4 py-3 ${won ? "bg-accent text-accent-ink" : "bg-paper"} ${home ? "border-t-[3px] border-ink" : ""}`}>
      <span className="display text-[44px]">{abbr}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px]">
        <span>NET {net === null ? "-" : signed(net)}</span>
        {home ? <span>· HOME</span> : null}
        <span className={b2b ? "bg-warn px-1.5 py-0.5 text-warn-ink" : "opacity-70"}>{restLabel(rest, b2b)}</span>
      </span>
      <span className="display text-right text-[52px]">{played ? pts : ""}</span>
    </div>
  );
  return (
    <div className="flex flex-col border-[3px] border-ink">
      {mine ? <span className="label bg-ink px-4 py-1.5 text-white">Your team · {mine}</span> : null}
      {row(g.away, g.awayPts, g.awayNet, g.awayRest, g.awayB2B, played && !homeWon, false)}
      {row(g.home, g.homePts, g.homeNet, g.homeRest, g.homeB2B, homeWon, true)}
      <div className="flex flex-wrap justify-between gap-3 border-t-[3px] border-ink bg-soft px-4 py-2.5 font-mono text-[12px]">
        {played && g.top ? (
          <>
            <span>TOP: {g.top.name}, {g.top.team}</span>
            <span>{g.top.pts} pts, {g.top.reb} reb, {g.top.ast} ast</span>
          </>
        ) : (
          <>
            <span>{g.final ? "Final" : g.status || tipTime(g.tipUtc)}</span>
            <span>{g.label ?? ""}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default async function Tonight({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mine = await myTeam();
  const date = one(sp.date);
  const d = await pageData<TonightData>("tonight", [date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null]);
  if (!d.date || !d.games.length) return <Wrap className="py-20"><Empty>No games found for this date.</Empty></Wrap>;

  const isMine = (g: { home: string; away: string }) => !!mine && (g.home === mine.abbr || g.away === mine.abbr);
  const n = d.games.length;
  const played = d.games.filter((g) => g.final && g.homePts !== null && g.awayPts !== null);
  const allPlayed = played.length === n;
  const b2bTeams = d.games.flatMap((g) => [g.awayB2B ? g.away : null, g.homeB2B ? g.home : null]).filter(Boolean) as string[];
  const mismatch = d.games
    .filter((g) => g.homeNet !== null && g.awayNet !== null)
    .map((g) => ({ g, gap: Math.abs(g.homeNet! - g.awayNet!), fav: g.homeNet! >= g.awayNet! ? g.home : g.away }))
    .sort((a, b) => a.gap - b.gap);
  const closest = mismatch[0];
  const ratingNote = d.ratingSeason ? `Net ratings are from ${d.ratingSeason}-${String((d.ratingSeason + 1) % 100).padStart(2, "0")}.` : "";

  const results = played
    .map((g) => ({ g, m: Math.abs(g.homePts! - g.awayPts!), winner: g.homePts! > g.awayPts! ? g.home : g.away, loser: g.homePts! > g.awayPts! ? g.away : g.home }))
    .sort((x, y) => y.m - x.m);
  const topScorer = played.map((g) => g.top).filter(Boolean).sort((x, y) => y!.pts - x!.pts)[0];

  const title = n === 1 ? "1 game" : `${n} games`;
  const subtitle = allPlayed
    ? n === 1 ? `${results[0].winner} beat ${results[0].loser} by ${results[0].m}` : `The home team won ${played.filter((g) => g.homePts! > g.awayPts!).length} of them`
    : b2bTeams.length
      ? `${b2bTeams.length} ${b2bTeams.length === 1 ? "team is" : "teams are"} on a back-to-back`
      : "Nobody is on a back-to-back";

  let notice: string | null = null;
  if (d.isUpcoming) notice = `No games today. Showing the next game night, ${longDate(d.date)}.`;
  else if (!d.isToday) notice = `Showing ${longDate(d.date)}${d.seasonType === "Playoffs" ? " (playoffs)" : ""}.`;

  return (
    <div style={teamTheme(mine?.abbr)}>
      {notice ? <Notice>{notice} Pick another date below.</Notice> : null}
      <Hero
        eyebrow={`Tonight · ${longDate(d.date)}`}
        title={title}
        controls={
          <form className="label inline-flex items-center gap-2 border-2 border-current px-3 py-1.5">
            <span className="opacity-80">Date</span>
            <input type="date" name="date" defaultValue={d.date} className="bg-transparent font-mono text-[13px] outline-none [color-scheme:dark]" />
            <button type="submit" className="border-l-2 border-current pl-2">Go</button>
          </form>
        }
        side={
          allPlayed && topScorer ? (
            <div className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-1 border-t-[3px] border-current pb-16 pt-4">
              <span className="display display-tight text-[84px]">{topScorer.pts}</span>
              <span className="text-[17px]">points from {topScorer.name} ({topScorer.team}), the top scorer of the night.</span>
            </div>
          ) : closest ? (
            <div className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-1 border-t-[3px] border-current pb-16 pt-4">
              <span className="label">Closest matchup on paper</span>
              <span className="display text-[64px]">{closest.g.away} @ {closest.g.home}</span>
              <span className="text-[17px]">Net ratings {closest.gap.toFixed(1)} apart. {ratingNote}</span>
            </div>
          ) : null
        }
      >
        <span className="display text-[clamp(30px,3.4vw,48px)] font-extrabold">{subtitle}</span>
      </Hero>

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading
            title={
              allPlayed
                ? n === 1 ? "The result, with each team's season net rating" : `${results.filter((x) => x.m <= 5).length} of ${n} games were decided by 5 points or fewer.`
                : b2bTeams.length
                  ? `Watch ${b2bTeams.join(", ")}: second night of a back-to-back, when teams win about 42% of the time.`
                  : `Every team is rested tonight. Expect results to follow the ratings.`
            }
            caption={`Away team on top, home team below. ${allPlayed ? "The winner is filled." : "Tip-off times are US Eastern."} ${ratingNote}`}
          />
          <Legend items={[
            { label: "Winner", color: "var(--accent)" },
            { label: "Second night of a back-to-back", color: "var(--warn)" },
          ]} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-4">
            {[...d.games].sort((x, y) => Number(isMine(y)) - Number(isMine(x))).map((g) => (
              <GameCard key={g.id} g={g} mine={isMine(g) && mine ? `${mine.city} ${mine.name}` : undefined} />
            ))}
          </div>
        </Section>

        {results.length > 1 ? (
          <Section className="flex flex-col gap-6">
            <ChartCard title={`Biggest margin: ${results[0].winner} by ${results[0].m}.`} description="Winning margin by game"
              legend={[{ label: "Home team won", color: "var(--accent)" }, { label: "Away team won", color: "var(--ink)" }]}
              note="The number is the winning margin.">
              <HorizontalBarChart
                name="Margin" icon="trophy" categoryWidth={140}
                data={results.map((x) => ({
                  key: String(x.g.id), label: `${x.winner} over ${x.loser}`, value: x.m, valueText: `+${x.m}`,
                  fill: x.winner === x.g.home ? "var(--accent)" : "var(--ink)",
                  tips: [{ label: "Winner", value: x.winner === x.g.home ? "Home" : "Away", icon: "house" as const }],
                }))}
              />
            </ChartCard>
          </Section>
        ) : null}
      </Wrap>
    </div>
  );
}
