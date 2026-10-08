import type { Metadata } from "next";
import Link from "next/link";
import { selectTeam } from "@/app/actions";
import { CandyBowl, type BowlTeam } from "@/components/picker/candy-bowl";
import { pageData } from "@/lib/db";
import { myTeam } from "@/lib/my-team";
import { TEAMS, logoUrl, teamColor } from "@/lib/teams";
import type { LeagueData } from "@/lib/types";

export const metadata: Metadata = { title: "Pick your team" };

/** Team picker: every team is a candy in a bowl. Picking one saves it, and every other page then shows that team's view. */
export default async function PickTeam() {
  const mine = await myTeam();
  // Records are a nice extra on the picker, so a failed query just leaves them out
  const league = await pageData<LeagueData>("league", [null]).catch(() => null);
  const records = new Map((league?.teams ?? []).map((r) => [r.abbr, `${r.w}-${r.l}`]));

  const teams: BowlTeam[] = [...TEAMS]
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
    .map((t) => {
      const color = teamColor(t.abbr);
      return {
        abbr: t.abbr, full: `${t.city} ${t.name}`, nick: t.name, logo: logoUrl(t.id), record: records.get(t.abbr) ?? null,
        color: color === "#000000" ? "#1D1F24" : color, // pure black reads as a hole, so black brands get a soft near-black
      };
    });

  return (
    <>
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-5 md:px-8 md:py-7">
        <Link href="/" className="display text-[22px] tracking-[0.05em]">Courtside</Link>
        {mine ? (
          <Link href="/team" className="text-[15px] text-muted transition-colors hover:text-ink">Back to the {mine.name} report</Link>
        ) : (
          <Link href="/" className="text-[15px] text-muted transition-colors hover:text-ink">Back</Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 md:px-8">
        <CandyBowl teams={teams} current={mine?.abbr ?? null} />

        {/* The plain list: works for keyboards, screen readers and browsers without JavaScript */}
        <details className="group mt-6">
          <summary className="mx-auto w-fit cursor-pointer list-none text-[15px] text-muted underline underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Or choose from a list</span>
            <span className="hidden group-open:inline">Hide the list</span>
          </summary>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            {(["West", "East"] as const).map((conf) => (
              <section key={conf}>
                <h2 className="border-b border-line pb-2.5 text-[14px] font-semibold text-muted">{conf}ern Conference</h2>
                <ul className="mt-1.5 sm:columns-2 sm:gap-5">
                  {TEAMS.filter((t) => t.conf === conf)
                    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
                    .map((t) => (
                      <li key={t.abbr} className="break-inside-avoid">
                        <form action={selectTeam}>
                          <input type="hidden" name="abbr" value={t.abbr} />
                          <button type="submit" className="flex w-full cursor-pointer items-center gap-2.5 px-1.5 py-2.5 text-left text-[15px] hover:bg-soft">
                            <span className="size-3.5 flex-none rounded-full" style={{ background: teamColor(t.abbr) }} />
                            {t.city} {t.name}
                            <small className="ml-auto font-mono text-[12px] text-muted">
                              {mine?.abbr === t.abbr ? "Your team" : records.get(t.abbr)}
                            </small>
                          </button>
                        </form>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      </main>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-col gap-1.5 px-4 py-7 text-[13px] text-muted md:flex-row md:justify-between md:px-8">
        <span>Unofficial project. Not affiliated with or endorsed by the NBA.</span>
        <span>Team logos belong to their owners.</span>
      </footer>
    </>
  );
}
