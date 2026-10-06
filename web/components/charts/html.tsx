// Charts drawn with plain HTML and SVG: tables with bars, heatmaps and the court. Bar charts live in recharts.tsx.
import { cn } from "@/lib/utils";
import { dec3, ordinal, pct } from "@/lib/format";
import { FACTOR_META, zoneName } from "@/lib/insights";
import type { Zone } from "@/lib/types";

/** One bar growing left or right from a centre line, sized for a table cell. Positive goes right. */
export function DivergingBar({ value, max, tone }: { value: number; max: number; tone: "accent" | "warn" | "ink" }) {
  const half = Math.min(50, (Math.abs(value) / max) * 50);
  const color = tone === "warn" ? "var(--warn)" : tone === "ink" ? "var(--ink)" : "var(--accent)";
  return (
    <div className="relative h-[14px]">
      <div className="absolute inset-y-[-4px] left-1/2 border-l border-ink" />
      <div className="absolute top-0 h-[14px] rounded-[3px]" style={{ background: color, width: `${half}%`, left: value >= 0 ? "50%" : `${50 - half}%` }} />
    </div>
  );
}

/** Four factors for one team against the league, with ranks out of 30. */
export function FactorTable({ team, league, ranks, abbr, meta = FACTOR_META }: {
  team: Record<string, number | string>; league: Record<string, number>; ranks: Record<string, number>; abbr: string;
  meta?: { key: string; label: string; hint: string }[];
}) {
  return (
    <div className="flex flex-col">
      <Legend style={{ marginBottom: 22 }} items={[
        { label: "Top 5 in the league", color: "var(--accent)" },
        { label: "Bottom 10", color: "var(--warn)" },
        { label: "In between", color: "var(--ink)" },
      ]} />
      <div className="label grid grid-cols-[minmax(130px,1.2fr)_76px_76px_64px] gap-3 border-b-[3px] border-ink pb-2 text-muted">
        <span>Factor</span><span className="text-right">{abbr}</span><span className="text-right">League</span><span className="text-right">Rank</span>
      </div>
      {meta.map((m) => {
        const rank = ranks[m.key];
        const tone = rank <= 5 ? "var(--accent)" : rank >= 21 ? "var(--warn)" : "var(--ink)";
        return (
          <div key={m.key} className="row-hover grid grid-cols-[minmax(130px,1.2fr)_76px_76px_64px] items-center gap-3 border-b border-line py-3.5">
            <div className="flex flex-col">
              <span className="display text-[24px] font-extrabold tracking-[0.03em]">{m.label}</span>
              <span className="text-[13px] text-muted">{m.hint}</span>
            </div>
            <span className="display text-right text-[34px]" style={{ color: tone }}>{dec3(Number(team[m.key]))}</span>
            <span className="text-right font-mono text-[15px] text-muted">{dec3(league[m.key])}</span>
            <span className="text-right font-mono text-[15px] font-medium">{ordinal(rank)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Shapes of each shot zone on a half court, in the same coordinates as ShotHeatmap (500 x 353, hoop at
// 250,300, baseline at the bottom). "Left" is the left side on screen, as in the shot maps.
const THREE_AREA = "M30 352.5 V210.5 A237.5 237.5 0 0 1 470 210.5 V352.5 Z"; // inside the three-point line
const PAINT = "M170 162.5 H330 V352.5 H170 Z";
const RIM = "M210 352.5 V300 A40 40 0 0 1 290 300 V352.5 Z"; // restricted area, 4 feet from the hoop
const ZONE_SHAPES: Record<string, string> = {
  "Restricted Area": RIM,
  "In The Paint (Non-RA)": `${PAINT} ${RIM}`,              // the paint with the restricted area cut out
  "Mid-Range": `${THREE_AREA} ${PAINT}`,                     // inside the arc, outside the paint
  // Corners are only 3 feet wide, so they are drawn a little wider to read at icon size
  "Left Corner 3": "M0 210.5 H44 V352.5 H0 Z",
  "Right Corner 3": "M456 210.5 H500 V352.5 H456 Z",
  "Above the Break 3": "M0 0 H500 V210.5 H470 A237.5 237.5 0 0 0 30 210.5 H0 Z",
};

/** A small half court with one shot zone filled in, so the reader can see where it is. */
export function ZoneIcon({ zone, className }: { zone: string; className?: string }) {
  const shape = ZONE_SHAPES[zone];
  if (!shape) return null;
  return (
    <svg viewBox="0 0 500 353" style={{ width: 56, height: 40 }} className={cn("shrink-0", className)} role="img" aria-label={`${zoneName(zone)} on the court`}>
      <rect x="1" y="1" width="498" height="351" fill="var(--soft)" />
      <path d={shape} fill="var(--accent)" fillRule="evenodd" />
      <g fill="none" stroke="var(--panel-muted)" strokeWidth={10} strokeOpacity={0.55}>
        <rect x="5" y="5" width="490" height="343" />
        <path d={PAINT} />
        <path d="M30 352.5 V210.5 A237.5 237.5 0 0 1 470 210.5 V352.5" />
      </g>
      <circle cx="250" cy="300" r="14" fill="none" stroke="var(--ink)" strokeWidth={10} />
    </svg>
  );
}

// Inline column layout for the zone table, so it holds even before a stylesheet rebuild
const ZONE_COLS = { gridTemplateColumns: "minmax(180px,1.2fr) minmax(0,1.4fr) 70px 70px" };

/** Shot share and make rate by zone, for a team against a comparison (league or opponent). */
export function ZoneRows({ zones, compare, abbr, compareLabel }: { zones: Zone[]; compare: Zone[]; abbr: string; compareLabel: string }) {
  const cmp = new Map(compare.map((z) => [z.zone, z]));
  const rows = zones.filter((z) => z.zone !== "Backcourt");
  const max = Math.max(0.35, ...rows.map((z) => z.share), ...compare.map((z) => z.share));
  return (
    <div className="flex flex-col">
      <Legend style={{ marginBottom: 22 }} items={[
        { label: `${abbr} share of shots`, color: "var(--accent)" },
        { label: `${compareLabel} share of shots`, color: "var(--ink)" },
      ]} />
      <div className="label grid gap-3 border-b-[3px] border-ink pb-2 text-muted" style={ZONE_COLS}>
        <span>Zone</span><span>Share of shots</span><span className="text-right">{abbr} FG%</span><span className="text-right">{compareLabel}</span>
      </div>
      {rows.map((z) => {
        const c = cmp.get(z.zone);
        return (
          <div key={z.zone} className="row-hover grid items-center gap-3 border-b border-line py-3" style={ZONE_COLS}>
            <div className="flex items-center gap-3">
              <ZoneIcon zone={z.zone} />
              <span className="display text-[20px] font-extrabold leading-tight tracking-[0.03em]">{zoneName(z.zone)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="relative h-3 bg-soft"><div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${(z.share / max) * 100}%` }} /></div>
              {c ? <div className="relative h-1.5"><div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${(c.share / max) * 100}%` }} /></div> : null}
              <span className="font-mono text-[11px] text-muted">{abbr} {pct(z.share)}{c ? ` · ${compareLabel.toLowerCase()} ${pct(c.share)}` : ""}</span>
            </div>
            <span className="display text-right text-[28px]">{pct(z.fg)}</span>
            <span className="text-right font-mono text-[14px] text-muted">{c ? pct(c.fg) : "-"}</span>
          </div>
        );
      })}
    </div>
  );
}

const MONTHS: [number, string][] = [[10, "Oct"], [11, "Nov"], [12, "Dec"], [1, "Jan"], [2, "Feb"], [3, "Mar"], [4, "Apr"]];

/** Back-to-backs per team per month, on the heat scale (red = more). */
export function MonthHeatmap({ months }: { months: [string, number, number][] }) {
  const teams = new Map<string, Map<number, number>>();
  for (const [t, m, n] of months) {
    if (!teams.has(t)) teams.set(t, new Map());
    teams.get(t)!.set(m, n);
  }
  const rows = [...teams.entries()]
    .map(([t, m]) => ({ t, m, total: [...m.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.t.localeCompare(b.t));
  const top = Math.max(1, ...months.map((m) => m[2]));
  return (
    <div className="flex flex-col">
      <div className="label grid grid-cols-[52px_repeat(7,minmax(0,1fr))_44px] gap-[3px] border-b-[3px] border-ink pb-2 text-center text-muted">
        <span className="text-left">Team</span>
        {MONTHS.map(([, l]) => <span key={l}>{l}</span>)}
        <span>All</span>
      </div>
      {rows.map((r) => (
        <div key={r.t} className="grid h-[30px] grid-cols-[52px_repeat(7,minmax(0,1fr))_44px] items-center gap-[3px]">
          <span className="display text-[19px] font-extrabold tracking-[0.04em]">{r.t}</span>
          {MONTHS.map(([m]) => {
            const n = r.m.get(m) ?? 0;
            const share = n / top;
            return (
              <div
                key={m}
                className="flex h-[26px] items-center justify-center font-mono text-[12px] font-medium"
                style={{
                  background: n === 0 ? "var(--soft)" : heatColor(share),
                  color: n > 0 && (share < 0.15 || share > 0.85) ? "#FFFFFF" : "var(--ink)",
                }}
              >
                {n}
              </div>
            );
          })}
          <span className="text-center font-mono text-[13px] font-medium">{r.total}</span>
        </div>
      ))}
      <HeatLegend low="Fewer back-to-backs" high="More" />
    </div>
  );
}

/** Half-court heatmap of where a player shoots from, built from 5-foot squares and softened with a blur. */
// The usual heatmap scale, cool to hot: blue (few) through light blue, pale yellow and orange to red (most).
const HEAT_STOPS = ["#2C7BB6", "#ABD9E9", "#FFFFBF", "#FDAE61", "#D7191C"];

/** Colour for a value between 0 (fewest) and 1 (most) on the heat scale. */
export function heatColor(t: number) {
  const x = Math.min(1, Math.max(0, t)) * (HEAT_STOPS.length - 1);
  const i = Math.min(HEAT_STOPS.length - 2, Math.floor(x));
  return `color-mix(in srgb, ${HEAT_STOPS[i + 1]} ${Math.round((x - i) * 100)}%, ${HEAT_STOPS[i]})`;
}

/** Small key under a heatmap: the colour scale from fewer to more. */
export function HeatLegend({ low = "Fewer", high = "More" }: { low?: string; high?: string }) {
  return (
    <div className="label mt-3 flex items-center gap-2 text-muted">
      <span>{low}</span>
      <span className="h-2.5 w-32 rounded-full" style={{ background: `linear-gradient(to right, ${HEAT_STOPS.join(", ")})` }} />
      <span>{high}</span>
    </div>
  );
}

export function ShotHeatmap({ bins }: { bins: [number, number, number, number][] }) {
  const peak = Math.max(1, ...bins.map((b) => b[2]));
  const line = "var(--panel-grid)";
  return (
    <>
    <svg viewBox="0 0 500 353" className="block h-auto w-full" role="img" aria-label="Shot location heatmap">
      <defs>
        <filter id="heat-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="16" /></filter>
        <clipPath id="court-clip"><rect x="1" y="1" width="498" height="351" /></clipPath>
      </defs>
      <g clipPath="url(#court-clip)">
        <g filter="url(#heat-blur)">
          {bins.filter((b) => b[2] >= 2).sort((p, q) => p[2] - q[2]).map(([x, y, a]) => {
            const t = Math.sqrt(a / peak);
            return (
              <circle
                key={`${x},${y}`}
                cx={x + 275}
                cy={300 - y - 25}
                r={22 + t * 22}
                fill={heatColor(t)}
                opacity={Math.min(1, 0.6 + t)}
              />
            );
          })}
        </g>
      </g>
      <g fill="none" stroke={line} strokeWidth={2} style={{ stroke: "color-mix(in srgb, var(--panel-ink) 35%, transparent)" }}>
        <rect x="1" y="1" width="498" height="351" />
        <rect x="170" y="162.5" width="160" height="190" />
        <circle cx="250" cy="162.5" r="60" />
        <path d="M210 300 A40 40 0 0 1 290 300" />
        <path d="M30 352.5 V210.5 A237.5 237.5 0 0 1 470 210.5 V352.5" />
        <line x1="220" y1="312.5" x2="280" y2="312.5" strokeWidth={3} />
        <circle cx="250" cy="300" r="7.5" />
      </g>
    </svg>
    <HeatLegend low="Fewer shots" high="More" />
    </>
  );
}

/** One legend entry. kind: a filled box (bars, tiles), a solid line, a dashed line, or a dot (scatter points). */
export type LegendItem = { label: string; color: string; kind?: "box" | "line" | "dashed" | "dot" };

/** Small key for a chart: what each colour, line and dot means. */
export function Legend({ items, className, style }: { items: LegendItem[]; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[12px] text-muted", className)} style={style}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2">
          {i.kind === "line" ? (
            <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: i.color }} />
          ) : i.kind === "dashed" ? (
            <span className="inline-block w-4" style={{ borderTop: `2px dashed ${i.color}` }} />
          ) : i.kind === "dot" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          ) : (
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
