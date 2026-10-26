"use client";

import { useEffect, useRef, useState } from "react";
import { HeatLegend, heatColor } from "./html";
import { RemoteImage } from "@/components/remote-image";
import { logoUrl, teamInfo } from "@/lib/teams";
import type { ScheduleGame } from "@/lib/types";

const MONTHS: [number, string, string][] = [
  [10, "Oct", "October"], [11, "Nov", "November"], [12, "Dec", "December"], [1, "Jan", "January"],
  [2, "Feb", "February"], [3, "Mar", "March"], [4, "Apr", "April"],
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLS = "grid-cols-[52px_repeat(7,minmax(0,1fr))_44px]";
// Both views share one fixed-height box, so opening a month never changes the card's size.
// Six weeks of 48px rows plus the header, weekdays and legend fit in it.
const BOX = "h-[420px]";
const ZOOM = "transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms ease";

/** "2026-11-04" -> year, month (1-12) and day, read as a calendar date with no time zone. */
function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** The tooltip lines for one game. Tip-off is shown in the viewer's own time zone. */
function describe(g: ScheduleGame) {
  const [date, opp, home, b2b, b2bFirst, final, pts, oppPts, tip] = g;
  const { y, m, d } = parts(date);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const other = teamInfo(opp);
  const lines = [`${day} · ${home ? "vs" : "at"} ${other ? `${other.city} ${other.name}` : opp}`];
  if (final && pts !== null && oppPts !== null) {
    lines.push(`${pts > oppPts ? "Won" : "Lost"} ${pts}–${oppPts}`);
  } else if (tip) {
    lines.push(`Tip-off ${new Date(tip).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`);
  }
  if (b2b) lines.push("Second night of a back-to-back");
  else if (b2bFirst) lines.push("First night of a back-to-back");
  return lines;
}

/**
 * Back-to-backs by month for one team. Clicking a month zooms into its calendar in the same box; the back
 * button (or Esc) zooms out to the month strip again. Each game day shows the opponent, both nights of a
 * back-to-back are marked, and hovering (or focusing) a day shows the full opponent, tip-off time or result.
 */
export function ScheduleCalendar({ abbr, months, games }: {
  abbr: string; months: [string, number, number][]; games: ScheduleGame[];
}) {
  const [open, setOpen] = useState(false);
  // The month stays set while zooming out, so the calendar can shrink back into its cell
  const [month, setMonth] = useState<number | null>(null);
  const [origin, setOrigin] = useState("50% 30%");
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<number, HTMLButtonElement>());
  const back = useRef<HTMLButtonElement>(null);

  const counts = new Map(months.filter((m) => m[0] === abbr).map((m) => [m[1], m[2]]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = Math.max(1, ...counts.values());
  const gamesIn = (m: number) => games.filter((g) => parts(g[0]).m === m);
  const withGames = MONTHS.map(([m]) => m).filter((m) => gamesIn(m).length > 0);
  // Back-to-back pairs (first night, second night). The overview lists the ones still to come, or the
  // whole season's once it is over.
  const pairs = games.flatMap((g, i) => (g[3] && i > 0 ? [[games[i - 1], g] as const] : []));
  const upcoming = pairs.filter(([, second]) => !second[5]);
  const listed = (upcoming.length ? upcoming : pairs).slice(0, 6);
  const more = (upcoming.length ? upcoming : pairs).length - listed.length;

  // Zoom from (and back into) the clicked month's cell
  const aimAt = (m: number) => {
    const cell = cells.current.get(m)?.getBoundingClientRect();
    const frame = box.current?.getBoundingClientRect();
    if (cell && frame) {
      setOrigin(`${cell.left + cell.width / 2 - frame.left}px ${cell.top + cell.height / 2 - frame.top}px`);
    }
  };
  const zoomIn = (m: number) => { aimAt(m); setMonth(m); setHover(null); setOpen(true); };
  const zoomOut = () => { if (month !== null) aimAt(month); setHover(null); setOpen(false); };
  const step = (dir: -1 | 1) => {
    setHover(null);
    setMonth((cur) => withGames[Math.min(withGames.length - 1, Math.max(0, withGames.indexOf(cur ?? -1) + dir))] ?? cur);
  };

  // Keyboard: Esc zooms out; focus follows the zoom so keyboard users land in the right view
  useEffect(() => {
    if (!open) return;
    back.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") zoomOut(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open && month !== null) cells.current.get(month)?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open, month]);

  const shown = month === null ? [] : gamesIn(month);
  const first = shown[0] ? parts(shown[0][0]) : null;
  const byDay = new Map(shown.map((g) => [parts(g[0]).d, g]));
  const daysInMonth = first ? new Date(Date.UTC(first.y, first.m, 0)).getUTCDate() : 0;
  const lead = first ? new Date(Date.UTC(first.y, first.m - 1, 1)).getUTCDay() : 0;
  const monthName = MONTHS.find((m) => m[0] === month)?.[2];
  const monthB2b = month === null ? 0 : counts.get(month) ?? 0;
  const at = withGames.indexOf(month ?? -1);

  return (
    <div ref={box} className={`relative ${BOX} overflow-clip motion-reduce:[&>*]:!transform-none`}>
      {/* Overview: the month strip. Zooming in blows it up toward the clicked cell and fades it out. */}
      <div
        aria-hidden={open}
        inert={open}
        className="absolute inset-0 flex flex-col"
        style={{ transformOrigin: origin, transform: open ? "scale(2.4)" : "scale(1)", opacity: open ? 0 : 1, transition: ZOOM }}
      >
        <div className={`label grid ${COLS} gap-[3px] border-b-[3px] border-ink pb-2 text-center text-muted`}>
          <span className="text-left">Team</span>
          {MONTHS.map(([, l]) => <span key={l}>{l}</span>)}
          <span>All</span>
        </div>
        <div className={`grid h-[30px] ${COLS} items-center gap-[3px]`}>
          <span className="display text-[19px] font-extrabold tracking-[0.04em]">{abbr}</span>
          {MONTHS.map(([m, , name]) => {
            const n = counts.get(m) ?? 0;
            const share = n / top;
            const has = withGames.includes(m);
            return (
              <button
                key={m}
                ref={(el) => { if (el) cells.current.set(m, el); }}
                type="button"
                disabled={!has}
                aria-label={`${name}: ${n} back-to-back${n === 1 ? "" : "s"}. Open the ${name} calendar`}
                onClick={() => zoomIn(m)}
                className="flex h-[26px] items-center justify-center font-mono text-[12px] font-medium transition-[box-shadow] hover:shadow-[0_0_0_2px_var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:hover:shadow-none"
                style={{
                  background: n === 0 ? "var(--soft)" : heatColor(share),
                  color: n > 0 && (share < 0.15 || share > 0.85) ? "#FFFFFF" : "var(--ink)",
                  cursor: has ? "zoom-in" : "default",
                }}
              >
                {n}
              </button>
            );
          })}
          <span className="text-center font-mono text-[13px] font-medium">{total}</span>
        </div>
        <HeatLegend low="Fewer back-to-backs" high="More" />
        {listed.length ? (
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="label flex items-baseline justify-between border-b border-line pb-2 text-muted">
              <span>{upcoming.length ? "Next back-to-backs" : "Every back-to-back"}</span>
              <span>Click one to open its month</span>
            </div>
            <ul>
              {listed.map(([a, b]) => {
                const pa = parts(a[0]), pb = parts(b[0]);
                const mon = MONTHS.find((x) => x[0] === pa.m)?.[1];
                const monB = MONTHS.find((x) => x[0] === pb.m)?.[1];
                const dates = pa.m === pb.m ? `${mon} ${pa.d}–${pb.d}` : `${mon} ${pa.d}–${monB} ${pb.d}`;
                const res = (g: ScheduleGame) => (g[5] && g[6] !== null && g[7] !== null ? (g[6] > g[7] ? " W" : " L") : "");
                return (
                  <li key={b[0]} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => zoomIn(pb.m)}
                      className="grid w-full grid-cols-[88px_1fr_1fr] items-center gap-2 py-2 text-left hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                      style={{ cursor: "zoom-in" }}
                    >
                      <span className="font-mono text-[13px] font-medium">{dates}</span>
                      <span className="truncate font-mono text-[13px] text-muted">
                        {a[2] ? "vs" : "@"} {a[1]}<span className="font-medium text-ink">{res(a)}</span>
                      </span>
                      <span className="truncate font-mono text-[13px] font-semibold" style={{ color: "var(--warn)" }}>
                        {b[2] ? "vs" : "@"} {b[1]}<span className="text-ink">{res(b)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {more > 0 ? <p className="label mt-2 text-muted">+{more} more. Open a month to see them.</p> : null}
          </div>
        ) : (
          <p className="mt-6 text-[14px] text-muted">Click a month to zoom into its games.</p>
        )}
      </div>

      {/* Detail: one month's calendar. It grows out of the clicked cell and shrinks back into it. */}
      <div
        aria-hidden={!open}
        inert={!open}
        className="absolute inset-0 flex flex-col"
        style={{ transformOrigin: origin, transform: open ? "scale(1)" : "scale(0.12)", opacity: open ? 1 : 0, transition: ZOOM }}
      >
        {first ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b-[3px] border-ink pb-2">
              <button
                ref={back}
                type="button"
                onClick={zoomOut}
                className="label flex items-center gap-1.5 whitespace-nowrap text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                style={{ cursor: "zoom-out" }}
              >
                <span aria-hidden>←</span> All months
              </button>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous month" disabled={at <= 0} onClick={() => step(-1)}
                  className="label px-2 py-1 hover:bg-soft disabled:opacity-30 disabled:hover:bg-transparent">‹</button>
                <span className="display min-w-[140px] whitespace-nowrap text-center text-[22px] font-extrabold tracking-[0.03em]">{monthName} {first.y}</span>
                <button type="button" aria-label="Next month" disabled={at < 0 || at >= withGames.length - 1} onClick={() => step(1)}
                  className="label px-2 py-1 hover:bg-soft disabled:opacity-30 disabled:hover:bg-transparent">›</button>
              </div>
            </div>
            <div className="label mt-2 grid grid-cols-7 gap-[3px] text-center text-muted">
              {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-[3px]">
              {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const g = byDay.get(day);
                if (!g) {
                  return (
                    <div key={day} className="h-[48px] p-[3px] font-mono text-[11px] text-muted md:p-1" style={{ background: "var(--soft)", opacity: 0.55 }}>
                      {day}
                    </div>
                  );
                }
                const [date, opp, home, b2b, b2bFirst, final, pts, oppPts] = g;
                const other = teamInfo(opp);
                const slot = lead + i;
                const wd = slot % 7;
                const row = Math.floor(slot / 7);
                const lines = describe(g);
                const won = final && pts !== null && oppPts !== null ? pts > oppPts : null;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={lines.join(". ")}
                    onMouseEnter={() => setHover(date)}
                    onMouseLeave={() => setHover((h) => (h === date ? null : h))}
                    onFocus={() => setHover(date)}
                    onBlur={() => setHover((h) => (h === date ? null : h))}
                    onClick={() => setHover((h) => (h === date ? null : date))}
                    className="relative flex h-[48px] min-w-0 flex-col justify-between p-[3px] text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink md:p-1"
                    style={{
                      background: b2b ? "var(--warn)" : "var(--paper)",
                      color: b2b ? "#FFFFFF" : "var(--ink)",
                      boxShadow: b2bFirst ? "inset 0 0 0 2px var(--warn)" : "inset 0 0 0 1px var(--line)",
                    }}
                  >
                    <span className="flex items-start justify-between">
                      <span className="font-mono text-[10px] font-medium leading-none md:text-[11px]">{day}</span>
                      {other ? (
                        <span className="flex size-[16px] items-center justify-center rounded-full bg-white">
                          <RemoteImage src={logoUrl(other.id)} alt="" className="size-[13px]" />
                        </span>
                      ) : null}
                    </span>
                    <span className="whitespace-nowrap font-mono text-[9px] font-semibold leading-[1.15] sm:text-[10px] md:text-[11px]">
                      {home ? "vs" : "@"} {opp}
                      {/* The margin fits a narrow cell; the full score is in the tooltip */}
                      {won !== null ? <span className="block text-[9px] font-medium md:text-[10px]" style={{ opacity: 0.85 }}>{won ? "W" : "L"} {won ? "+" : "−"}{Math.abs(pts! - oppPts!)}</span> : null}
                    </span>
                    {hover === date ? (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute z-20 w-max max-w-[220px] bg-ink px-3 py-2 text-[12px] leading-snug text-white shadow-lg"
                        style={{
                          // The box clips overflow, so the top two rows open their tooltip downward
                          ...(row < 2 ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }),
                          ...(wd >= 5 ? { right: 0 } : wd <= 1 ? { left: 0 } : { left: "50%", transform: "translateX(-50%)" }),
                        }}
                      >
                        {lines.map((l, j) => <span key={j} className={j === 0 ? "block font-semibold" : "block"}>{l}</span>)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="label mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 pt-2 text-muted">
              <span className="flex items-center gap-2"><span className="size-3" style={{ background: "var(--warn)" }} />2nd night of a back-to-back</span>
              <span className="flex items-center gap-2"><span className="size-3" style={{ boxShadow: "inset 0 0 0 2px var(--warn)" }} />1st night</span>
              <span>vs home · @ away</span>
              <span className="ml-auto text-ink">{shown.length} games · {monthB2b} back-to-back{monthB2b === 1 ? "" : "s"}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
