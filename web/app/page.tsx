import type { Metadata } from "next";
import { Wrap } from "@/components/blocks";
import { RemoteImage } from "@/components/remote-image";
import { myTeam } from "@/lib/my-team";
import { TEAMS, logoUrl, onColor, teamColor } from "@/lib/teams";
import { selectTeam } from "./actions";

export const metadata: Metadata = { title: "Pick your team" };

/** Landing page. Picking a team saves it, and every other page then shows that team's view. */
export default async function Landing() {
  const mine = await myTeam();
  return (
    <div>
      <section className="bg-ink text-white">
        <Wrap className="flex flex-col gap-4 pb-12 pt-14">
          <span className="label text-[13px] text-[#A7AEBB]">Courtside Analytics</span>
          <h1 className="display text-[clamp(52px,8vw,120px)]">Pick your team</h1>
          <p className="max-w-[640px] text-[18px] text-[#A7AEBB]">
            Every page will open from your team&apos;s point of view: its report, its players, its schedule and its matchups.
            You can change teams at any time.
          </p>
        </Wrap>
      </section>
      <Wrap className="flex flex-col gap-12 pt-12">
        {(["West", "East"] as const).map((conf) => (
          <section key={conf} className="flex flex-col gap-4">
            <h2 className="display text-[clamp(28px,3vw,38px)]">{conf}ern Conference</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TEAMS.filter((t) => t.conf === conf)
                .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
                .map((t) => {
                  const bg = teamColor(t.abbr);
                  const chosen = mine?.abbr === t.abbr;
                  return (
                    <form key={t.abbr} action={selectTeam}>
                      <input type="hidden" name="abbr" value={t.abbr} />
                      <button
                        type="submit"
                        aria-label={`Choose ${t.city} ${t.name}`}
                        style={{ "--c": bg, "--on": onColor(bg) } as React.CSSProperties}
                        className="group flex h-full w-full cursor-pointer flex-col items-start gap-3 border-[3px] border-ink bg-paper p-4 text-left transition-colors hover:bg-[var(--c)] hover:text-[var(--on)] focus-visible:bg-[var(--c)] focus-visible:text-[var(--on)] focus-visible:outline-none data-[chosen]:bg-[var(--c)] data-[chosen]:text-[var(--on)]"
                        data-chosen={chosen || undefined}
                      >
                        <span className="flex h-[88px] w-full items-center justify-center bg-white p-2">
                          <RemoteImage src={logoUrl(t.id)} alt="" className="h-full w-auto" />
                        </span>
                        <span className="flex min-w-0 max-w-full flex-col">
                          <span className="label">{t.city}</span>
                          <span className="display max-w-full break-words text-[clamp(20px,2vw,28px)] font-extrabold leading-none tracking-[0.03em]">{t.name}</span>
                        </span>
                        {chosen ? <span className="label">Your team</span> : null}
                      </button>
                    </form>
                  );
                })}
            </div>
          </section>
        ))}
      </Wrap>
    </div>
  );
}
