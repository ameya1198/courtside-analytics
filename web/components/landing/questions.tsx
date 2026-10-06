"use client";

import { usePickedTeam } from "./picked-team";

// The question each dashboard page answers. {we}, {us} and {our} become the picked team's name.
const QUESTIONS = [
  ["Who is the team to beat, and who is moving?", "League Pulse"],
  ["Where do {we} win and lose games?", "Team Report"],
  ["Where do {we} give up points?", "Defense"],
  ["Which players are getting better, and which are slipping?", "Player Profile"],
  ["Who on {our} roster wins more than they cost?", "Player Value"],
  ["Do back-to-backs cost {us} games?", "Rest and Schedule"],
  ["How do {we} line up against the next opponent?", "Matchup Scout"],
  ["Who is playing tonight, and who is starring?", "Tonight"],
] as const;

function Question({ text, nick }: { text: string; nick: string | null }) {
  const parts = text.split(/(\{we\}|\{us\}|\{our\})/);
  return (
    <>
      {parts.map((p, i) => {
        if (!p.startsWith("{")) return p;
        return nick ? <span key={i} className="text-accent">the {nick}</span> : p.slice(1, -1);
      })}
    </>
  );
}

/** The questions, without the answers. Once a dot is picked they are asked about that team. */
export function Questions() {
  const { team } = usePickedTeam();
  return (
    <ol className="mt-14 grid border-t border-line md:grid-cols-2 md:gap-x-16">
      {QUESTIONS.map(([q, page], i) => (
        <li key={page} className={`flex flex-col gap-2.5 py-6 ${i > 0 ? "border-t border-line" : ""} ${i === 1 ? "md:border-t-0" : ""}`}>
          <span className="text-[clamp(21px,2vw,27px)] font-medium leading-[1.25] tracking-[-0.01em]">
            <Question text={q} nick={team?.nick ?? null} />
          </span>
          <span className="font-mono text-[12px] tracking-[0.06em] text-muted">{page}</span>
        </li>
      ))}
    </ol>
  );
}
