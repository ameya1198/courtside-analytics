"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { selectTeam } from "@/app/actions";
import { cn } from "@/lib/utils";
import { usePickedTeam } from "./picked-team";

const BUTTON =
  "inline-flex h-[52px] cursor-pointer items-center gap-2.5 whitespace-nowrap bg-ink px-[26px] text-[16px] font-semibold text-paper transition-[background-color,transform] duration-200 hover:bg-accent active:translate-y-px disabled:cursor-wait disabled:opacity-80";

function Submit({ nick }: { nick: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={BUTTON} disabled={pending}>
      {pending ? `Opening the ${nick} report` : `Open the ${nick} report`}
    </button>
  );
}

/** "Pick your team" until a dot is clicked. Then it saves that team, like the picker does, and opens its report. */
export function TeamCta({ className }: { className?: string }) {
  const { team } = usePickedTeam();
  if (!team) {
    return (
      <Link href="/pick" className={cn(BUTTON, className)}>
        Pick your team
      </Link>
    );
  }
  return (
    <form action={selectTeam} className={className}>
      <input type="hidden" name="abbr" value={team.abbr} />
      <Submit nick={team.nick} />
    </form>
  );
}
