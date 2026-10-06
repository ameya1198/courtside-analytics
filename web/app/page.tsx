import Link from "next/link";
import { PickedTeamProvider, type DotTeam } from "@/components/landing/picked-team";
import { Questions } from "@/components/landing/questions";
import { TeamCta } from "@/components/landing/team-cta";
import { TeamDots } from "@/components/landing/team-dots";
import { pageData } from "@/lib/db";
import { teamColor, teamInfo } from "@/lib/teams";
import type { LeagueData } from "@/lib/types";

export const revalidate = 3600;

const STEPS = [
  ["Pick your team.", "Every page then opens from its side: its players, its schedule, its next opponent, in its colours."],
  ["Read the headline.", "Each chart title is the finding and the move, so you know what to do before you read the axis."],
  ["Come back tomorrow.", "The numbers reload every night, so the morning after a game they already include it."],
] as const;

function rankBy(rows: LeagueData["teams"], key: "ortg" | "drtg" | "net", lowerIsBetter = false) {
  const order = [...rows].sort((a, b) => (lowerIsBetter ? a[key] - b[key] : b[key] - a[key]));
  return (abbr: string) => order.findIndex((r) => r.abbr === abbr) + 1;
}

/** Landing page. One unlabeled dot per team; finding yours leads into the team picker. */
export default async function Landing() {
  const d = await pageData<LeagueData>("league", [null]);
  const rows = d.teams ?? [];
  const netRank = rankBy(rows, "net"), offRank = rankBy(rows, "ortg"), defRank = rankBy(rows, "drtg", true);
  const teams: DotTeam[] = rows.map((r) => {
    const color = teamColor(r.abbr);
    return {
      abbr: r.abbr, full: r.name, nick: teamInfo(r.abbr)?.name ?? r.name,
      color: color === "#000000" ? "#3A3D44" : color, // black brands read as a hole on the chart
      w: r.w, l: r.l, net: r.net, netRank: netRank(r.abbr),
      offRank: r.off_rank ?? offRank(r.abbr), defRank: r.def_rank ?? defRank(r.abbr),
    };
  });

  return (
    <PickedTeamProvider>
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-5 md:px-8 md:py-7">
        <Link href="/" className="display text-[22px] tracking-[0.05em]">Courtside</Link>
        <nav className="flex items-center gap-7 text-[15px]">
          <a href="#what" className="hidden text-muted transition-colors hover:text-ink md:inline">What it is</a>
          <a href="#how" className="hidden text-muted transition-colors hover:text-ink md:inline">How it works</a>
          <Link href="/pick" className="border-b border-current pb-0.5 transition-colors hover:text-accent">Pick your team</Link>
        </nav>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-84px)] w-full max-w-[1200px] flex-col justify-center px-4 pb-12 md:px-8">
        <h1 className="display max-w-[12ch] text-[clamp(48px,7vw,104px)]">One of these is your team.</h1>
        {teams.length ? (
          <TeamDots teams={teams}>
            <TeamCta />
          </TeamDots>
        ) : (
          <div className="mt-12 flex flex-wrap items-center gap-7">
            <p className="text-muted">The standings are not loaded yet. Pick your team to go straight to its report.</p>
            <TeamCta />
          </div>
        )}
      </main>

      <section id="what" className="mx-auto w-full max-w-[1200px] scroll-mt-8 px-4 pt-24 md:px-8 md:pt-32">
        <h2 className="display max-w-[15ch] text-[clamp(40px,5vw,72px)]">Courtside is a front office in eight pages.</h2>
        <p className="mt-5 max-w-[52ch] text-[clamp(18px,1.6vw,21px)] leading-[1.5] text-muted">
          It answers the questions a general manager asks every week, for the team you pick. Every chart opens with the answer.
        </p>
        <Questions />
      </section>

      <section id="how" className="mx-auto w-full max-w-[1200px] scroll-mt-8 px-4 pt-24 md:px-8 md:pt-36">
        <h2 className="display text-[clamp(40px,5vw,72px)]">How it works.</h2>
        <div className="mt-14 grid md:grid-cols-3 md:gap-12 md:border-t-2 md:border-ink">
          {STEPS.map(([title, body]) => (
            <div key={title} className="border-t-2 border-ink pb-8 pt-6 md:border-t-0 md:pb-0 md:pt-8">
              <h3 className="display text-[clamp(32px,3vw,44px)] leading-[0.95]">{title}</h3>
              <p className="mt-3.5 max-w-[34ch] text-[17px] leading-[1.55] text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-[70ch] text-[15px] leading-[1.6] text-muted md:mt-14">
          <b className="font-medium text-ink">Where the numbers come from.</b> Games, players and shots from nba_api. Salaries and Win Shares
          from Basketball-Reference. Eleven seasons, cleaned and tested in dbt on a Postgres warehouse.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-[1200px] flex-wrap items-end justify-between gap-8 px-4 pb-24 pt-24 md:px-8 md:pt-36">
        <h2 className="display text-[clamp(40px,5vw,72px)]">Start with your team.</h2>
        <TeamCta />
      </section>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-col gap-1.5 px-4 py-7 text-[13px] text-muted md:flex-row md:justify-between md:px-8">
        <span>Unofficial project. Not affiliated with or endorsed by the NBA.</span>
        <span>Data: nba_api and Basketball-Reference, refreshed nightly.</span>
      </footer>
    </PickedTeamProvider>
  );
}
