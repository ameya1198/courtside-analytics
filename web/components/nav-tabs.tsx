"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "League Pulse" },
  { href: "/team", label: "Team Report" },
  { href: "/player", label: "Player Profile" },
  { href: "/value", label: "Player Value" },
  { href: "/rest", label: "Rest and Schedule" },
  { href: "/matchup", label: "Matchup Scout" },
  { href: "/tonight", label: "Tonight" },
];

export function NavTabs() {
  const path = usePathname();
  const params = useSearchParams();
  // Keep the chosen season when moving between pages.
  const season = params.get("season");
  return (
    <nav aria-label="Pages" className="overflow-x-auto border-b-[3px] border-ink">
      <div className="flex min-w-max px-2 md:px-3">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={season && t.href !== "/tonight" ? `${t.href}?season=${season}` : t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "display px-4 py-3 text-[19px] font-extrabold tracking-[0.05em] transition-colors md:px-5",
                active ? "bg-ink text-white" : "hover:bg-soft",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
