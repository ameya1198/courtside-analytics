"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { startNav } from "@/lib/nav-progress";
import { currentSeason, seasonLabel } from "@/lib/format";

/**
 * Last season / This season, plus older seasons in a small menu. Writes ?season= into the URL,
 * and the nav tabs carry it to the other pages. A season with no data on this page is greyed out.
 */
export function SeasonSwitch({ value, seasons, notReady = "Not enough games yet" }: { value: number; seasons: number[]; notReady?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const now = currentSeason();
  const go = (season: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("season", String(season));
    startNav(path);
    start(() => router.push(`${path}?${next.toString()}`));
  };
  const buttons = [
    { season: now - 1, label: "Last season" },
    { season: now, label: "This season" },
  ];
  const older = seasons.filter((s) => s < now - 1);
  return (
    <div className="label inline-flex flex-wrap items-stretch gap-2" data-pending={pending || undefined}>
      <div role="group" aria-label="Season" style={{ display: "inline-flex", border: "2px solid currentColor" }}>
        {buttons.map((b, i) => {
          const has = seasons.includes(b.season);
          const on = value === b.season;
          return (
            <button
              key={b.season}
              type="button"
              disabled={!has || on}
              aria-pressed={on}
              title={has ? undefined : notReady}
              onClick={() => go(b.season)}
              style={{
                padding: "8px 12px",
                borderLeft: i ? "2px solid currentColor" : undefined,
                boxShadow: on ? "inset 0 -5px 0 currentColor" : undefined,
                cursor: has && !on ? "pointer" : "default",
                opacity: on ? 1 : has ? 0.7 : 0.35,
                textAlign: "left",
                lineHeight: 1.15,
              }}
            >
              <span>
                <span style={{ display: "block", fontSize: 11, opacity: 0.8 }}>{b.label}</span>
                <span className="font-mono" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{seasonLabel(b.season)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {older.length ? (
        <label className="relative inline-flex items-center gap-2 border-2 border-current px-3 py-2">
          <span className="opacity-80">Earlier</span>
          <select
            className="cursor-pointer appearance-none bg-transparent pr-5 font-mono text-[13px] font-medium uppercase outline-none [&>option]:text-ink"
            value={older.includes(value) ? String(value) : ""}
            onChange={(e) => e.target.value && go(Number(e.target.value))}
          >
            <option value="">—</option>
            {older.map((s) => (
              <option key={s} value={s}>{seasonLabel(s)}</option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-[7px] -translate-y-[70%] rotate-45 border-b-2 border-r-2 border-current" />
        </label>
      ) : null}
      {pending ? <span aria-live="polite" className="self-center">…</span> : null}
    </div>
  );
}
