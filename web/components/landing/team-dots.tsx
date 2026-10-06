"use client";

import { useEffect, useRef, useState } from "react";
import { ordinal, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePickedTeam, type DotTeam } from "./picked-team";

// Dots sit on this line; ones that would touch move to the nearest free lane above or below it
const LINE_Y = 80;
const LANE_ORDER = [0, -1, 1, -2, 2, -3, 3];

/** Every team's net rating as an unlabeled dot. Hovering names it, clicking picks it. */
export function TeamDots({ teams, children }: { teams: DotTeam[]; children?: React.ReactNode }) {
  const { team: picked, pick } = usePickedTeam();
  const [hover, setHover] = useState<DotTeam | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const lo = Math.min(...teams.map((t) => t.net)) - 1;
  const hi = Math.max(...teams.map((t) => t.net)) + 1;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const sorted = [...teams].sort((a, b) => a.net - b.net);

  useEffect(() => {
    const el = chart.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lanes depend on the chart width, so they are worked out on the client after the first measure
  const size = width && width < 560 ? 16 : 22;
  const gap = size + 4;
  const lanes = new Map<string, number>();
  if (width) {
    const lastX: Record<number, number> = {};
    for (const t of sorted) {
      const x = (pct(t.net) / 100) * width;
      const lane = LANE_ORDER.find((l) => lastX[l] === undefined || x - lastX[l] >= gap) ?? 0;
      lastX[lane] = x;
      lanes.set(t.abbr, lane);
    }
  }

  const shown = hover ?? picked;
  const leak = (t: DotTeam) => (t.offRank > t.defRank ? `the offense (${ordinal(t.offRank)})` : `the defense (${ordinal(t.defRank)})`);

  return (
    <>
      <div
        ref={chart}
        role="group"
        aria-label="Net rating of all 30 teams"
        className={cn("group/chart relative mt-12 h-[200px] md:mt-[72px] md:h-[160px]", picked && "is-picked")}
        style={{ "--size": `${size}px` } as React.CSSProperties}
      >
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: LINE_Y }} />
        {shown ? (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[13px]"
            style={{ left: `${pct(shown.net)}%` }}
          >
            {shown.abbr} {signed(shown.net)}
          </div>
        ) : null}
        {sorted.map((t) => {
          const on = picked?.abbr === t.abbr;
          return (
            <button
              key={t.abbr}
              type="button"
              aria-label={`${t.full}, net rating ${signed(t.net)}`}
              aria-pressed={on}
              onClick={() => pick(t)}
              onMouseEnter={() => setHover(t)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(t)}
              onBlur={() => setHover(null)}
              className={cn(
                "absolute size-[var(--size)] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-ink",
                "transition-[transform,background-color,opacity,top] duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
                "group-hover/chart:opacity-25 [.is-picked_&]:opacity-25",
                "hover:!opacity-100 hover:scale-[1.45] hover:bg-[var(--c)] focus-visible:!opacity-100 focus-visible:scale-[1.45] focus-visible:bg-[var(--c)]",
                "focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-accent",
                on && "!opacity-100 scale-[1.45] bg-[var(--c)]",
                !width && "opacity-0",
              )}
              style={{ left: `${pct(t.net)}%`, top: LINE_Y + (lanes.get(t.abbr) ?? 0) * gap, "--c": t.color } as React.CSSProperties}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[12px] text-muted">
        <span>Worse</span>
        <span>Net rating, {teams.length} teams</span>
        <span>Better</span>
      </div>
      <div className="mt-14 flex flex-wrap items-end justify-between gap-7">
      <p className="min-h-[3lh] max-w-[44ch] text-[clamp(18px,1.6vw,22px)] leading-[1.45]" aria-live="polite">
        {picked ? (
          <>
            <b className="font-semibold">{picked.full}.</b> {ordinal(picked.netRank)} of 30 at {signed(picked.net)}, {picked.w}-{picked.l}. The place to
            look first is {leak(picked)}.
          </>
        ) : (
          <span className="text-[16px] text-muted">
            Find it. Every dot is a team, placed by points scored minus points allowed per 100 possessions.
          </span>
        )}
      </p>
      {children}
      </div>
    </>
  );
}
