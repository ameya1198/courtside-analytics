import type { Metadata } from "next";
import { Empty, Heading, Notice, Section, Wrap } from "@/components/blocks";
import { Hero } from "@/components/hero";
import { pageData } from "@/lib/db";
import { longDate, one, signed } from "@/lib/format";
import { teamTheme } from "@/lib/teams";
import type { TonightData } from "@/lib/types";

export const metadata: Metadata = { title: "Tonight" };
export const revalidate = 900;

export default async function Tonight({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const date = one(sp.date);
  const d = await pageData<TonightData>("tonight", [date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null]);
  if (!d.date || !d.games.length) return <Wrap className="py-20"><Empty>No games found on or before this date.</Empty></Wrap>;

  const homeWins = d.games.filter((g) => g.homePts > g.awayPts).length;
  const biggest = d.games
    .map((g) => ({ g, m: Math.abs(g.homePts - g.awayPts), winner: g.homePts > g.awayPts ? g.home : g.away, loser: g.homePts > g.awayPts ? g.away : g.home }))
    .sort((x, y) => y.m - x.m);
  const close = biggest.filter((x) => x.m <= 5).length;
  const n = d.games.length;
  const title = n === 1 ? "1 game" : `${n} games`;
  const subtitle = n === 1
    ? `${biggest[0].winner} beat ${biggest[0].loser} by ${biggest[0].m}`
    : `The home team won ${homeWins} of them`;
  const top = [...d.games].sort((x, y) => y.top.pts - x.top.pts)[0].top;

  return (
    <div style={teamTheme(null)}>
      {!d.isToday ? (
        <Notice>
          No games today. Showing the latest game night, {longDate(d.date)}{d.seasonType === "Playoffs" ? " (playoffs)" : ""}. In season this page shows the day&apos;s results after the nightly refresh.
        </Notice>
      ) : null}
      <Hero eyebrow={`Tonight · ${longDate(d.date)}`} title={title}
        controls={
          <form className="label inline-flex items-center gap-2 border-2 border-current px-3 py-1.5">
            <span className="opacity-80">Date</span>
            <input type="date" name="date" defaultValue={d.date} className="bg-transparent font-mono text-[13px] outline-none [color-scheme:dark]" />
            <button type="submit" className="border-l-2 border-current pl-2">Go</button>
          </form>
        }
        side={
          <div className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-1 border-t-[3px] border-current pb-12 pt-4">
            <span className="display text-[84px]">{top.pts}</span>
            <span className="text-[17px]">points from {top.name} ({top.team}), the top scorer of the night.</span>
          </div>
        }
      >
        <span className="display text-[clamp(30px,3.4vw,48px)] font-extrabold">{subtitle}</span>
      </Hero>

      <Wrap>
        <Section className="flex flex-col gap-6">
          <Heading
            title={n === 1 ? "The result, with each team's season net rating" : `${close} of ${n} games were decided by 5 points or fewer.`}
            caption="Away team on top, home team below. The winner is filled."
          />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-4">
            {d.games.map((g) => {
              const homeWon = g.homePts > g.awayPts;
              const row = (abbr: string, pts: number, net: number | null, won: boolean, home: boolean) => (
                <div className={`grid grid-cols-[76px_minmax(0,1fr)_72px] items-center gap-3 px-4 py-3 ${won ? "bg-accent text-accent-ink" : "bg-paper"} ${home ? "border-t-[3px] border-ink" : ""}`}>
                  <span className="display text-[44px]">{abbr}</span>
                  <span className="font-mono text-[13px]">NET {net === null ? "-" : signed(net)}{home ? " · HOME" : ""}</span>
                  <span className="display text-right text-[52px]">{pts}</span>
                </div>
              );
              return (
                <div key={g.home} className="flex flex-col border-[3px] border-ink">
                  {row(g.away, g.awayPts, g.awayNet, !homeWon, false)}
                  {row(g.home, g.homePts, g.homeNet, homeWon, true)}
                  <div className="flex flex-wrap justify-between gap-3 border-t-[3px] border-ink bg-soft px-4 py-2.5 font-mono text-[12px]">
                    <span>TOP: {g.top.name}, {g.top.team}</span>
                    <span>{g.top.pts} pts, {g.top.reb} reb, {g.top.ast} ast</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {n > 1 ? (
          <Section className="flex flex-col gap-6">
            <Heading title={`Biggest margin: ${biggest[0].winner} by ${biggest[0].m}.`} caption="Winning margin by game. The accent colour means the home team won." />
            <div className="flex flex-col">
              {biggest.map((x) => (
                <div key={x.g.home} className="grid grid-cols-[150px_minmax(0,1fr)_56px] items-center gap-3 border-b border-line py-2">
                  <span className="display text-[22px] font-extrabold tracking-[0.03em]">{x.winner} over {x.loser}</span>
                  <div className="h-5"><div className="h-5" style={{ width: `${(x.m / Math.max(1, biggest[0].m)) * 100}%`, background: x.winner === x.g.home ? "var(--accent)" : "var(--ink)" }} /></div>
                  <span className="text-right font-mono text-[14px] font-medium">+{x.m}</span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </Wrap>
    </div>
  );
}
