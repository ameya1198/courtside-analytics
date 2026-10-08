"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavProgressBar } from "./nav-progress";

const TABS = [
  { href: "/league", label: "League Pulse" },
  { href: "/team", label: "Team Report" },
  { href: "/defense", label: "Defense" },
  { href: "/player", label: "Player Profile" },
  { href: "/value", label: "Player Value" },
  { href: "/needs", label: "Roster Needs" },
  { href: "/rest", label: "Rest and Schedule" },
  { href: "/matchup", label: "Matchup Scout" },
  { href: "/tonight", label: "Tonight" },
];

export function NavTabs() {
  const path = usePathname();
  const params = useSearchParams();
  // Keep the chosen season when moving between pages.
  const season = params.get("season");
  // The wrapper lets the progress bar sit over the bottom border, outside the scrolling tab strip
  return (
    <div className="relative">
      <nav aria-label="Pages" className="overflow-x-auto border-b-[3px] border-ink">
        <div className="flex min-w-max px-2 md:px-3">
          {TABS.map((t) => {
            const active = path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={season && t.href !== "/tonight" ? `${t.href}?season=${season}` : t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "display px-4 py-3 text-[19px] font-extrabold tracking-[0.05em] transition-[background-color,box-shadow] duration-150 hover:bg-soft md:px-5",
                  active && "shadow-[inset_0_-3px_0_var(--accent)]",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <NavProgressBar />
    </div>
  );
}
