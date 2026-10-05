// Charts drawn with plain HTML and SVG: diverging bars, tables with bars, heatmaps and the court.
import { cn } from "@/lib/utils";
import { dec3, ordinal, pct } from "@/lib/format";
import { FACTOR_META, zoneName } from "@/lib/insights";
import type { Factors, Zone } from "@/lib/types";

type DivRow = { key: string; label: string; value: number; valueText: string; note?: string; tone?: "accent" | "warn" | "ink" };

/** Bars that grow left or right from a centre line. Positive values go right. */
export function Diverging({
  rows, max, leftLabel, rightLabel, labelWidth = 64, noteWidth = 120,
}: { rows: DivRow[]; max: number; leftLabel?: string; rightLabel?: string; labelWidth?: number; noteWidth?: number }) {
  const grid = { gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 64px ${noteWidth}px` };
  return (
    <div className="flex flex-col">
      {(leftLabel || rightLabel) && (
        <div className="label grid gap-3 border-b-[3px] border-ink pb-2" style={grid}>
          <span />
          <span className="flex justify-between"><span>{leftLabel}</span><span>{rightLabel}</span></span>
          <span />
          <span />
        </div>
      )}
      {rows.map((r) => {
        const half = Math.min(50, (Math.abs(r.value) / max) * 50);
        const color = r.tone === "warn" ? "var(--warn)" : r.tone === "ink" ? "var(--ink)" : "var(--accent)";
        return (
          <div key={r.key} className="grid items-center gap-3 border-b border-line py-2.5" style={grid}>
            <span className="display text-[22px] font-extrabold tracking-[0.03em]">{r.label}</span>
            <div className="relative h-[18px]">
              <div className="absolute inset-y-[-6px] left-1/2 border-l-2 border-ink" />
              <div
                className="absolute top-0 h-[18px]"
                style={{ background: color, width: `${half}%`, left: r.value >= 0 ? "50%" : `${50 - half}%` }}
              />
            </div>
            <span className="text-right font-mono text-[14px] font-medium">{r.valueText}</span>
            <span className="truncate font-mono text-[12px] text-muted">{r.note}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Bars that start at zero. Used for movers where each side has its own list. */
export function BarList({ rows, max, tone }: { rows: { key: string; label: string; value: number; valueText: string; note?: string }[]; max: number; tone: "accent" | "warn" }) {
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[56px_minmax(0,1fr)_64px_minmax(90px,130px)] items-center gap-3 border-b border-line py-3">
          <span className="display text-[24px] font-extrabold tracking-[0.04em]">{r.label}</span>
          <div className="h-[18px]">
            <div className="h-[18px]" style={{ width: `${Math.min(100, (Math.abs(r.value) / max) * 100)}%`, background: `var(--${tone})` }} />
          </div>
          <span className="text-right font-mono text-[15px] font-medium">{r.valueText}</span>
          <span className="font-mono text-[12px] text-muted">{r.note}</span>
        </div>
      ))}
    </div>
  );
}

export function PercentileBars({ rows }: { rows: { label: string; value: number }[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)_52px] items-center gap-3 border-b border-line py-2.5">
          <span className="display text-[22px] font-extrabold tracking-[0.03em]">{r.label}</span>
          <div className="relative h-[22px] bg-soft">
            <div className="absolute inset-y-0 left-0" style={{ width: `${r.value}%`, background: r.value >= 90 ? "var(--accent)" : "var(--ink)" }} />
            <div className="absolute inset-y-[-3px] left-1/2 border-l-2 border-ink" />
          </div>
          <span className="display text-right text-[30px]">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Four factors for one team against the league, with ranks out of 30. */
export function FactorTable({ team, league, ranks, abbr }: { team: Factors; league: Factors; ranks: Record<keyof Factors, number>; abbr: string }) {
  return (
    <div className="flex flex-col">
      <div className="label grid grid-cols-[minmax(130px,1.2fr)_76px_76px_64px] gap-3 border-b-[3px] border-ink pb-2">
        <span>Factor</span><span className="text-right">{abbr}</span><span className="text-right">League</span><span className="text-right">Rank</span>
      </div>
      {FACTOR_META.map((m) => {
        const rank = ranks[m.key];
        const tone = rank <= 5 ? "var(--accent)" : rank >= 21 ? "var(--warn)" : "var(--ink)";
        return (
          <div key={m.key} className="grid grid-cols-[minmax(130px,1.2fr)_76px_76px_64px] items-center gap-3 border-b border-line py-3.5">
            <div className="flex flex-col">
              <span className="display text-[24px] font-extrabold tracking-[0.03em]">{m.label}</span>
              <span className="text-[13px] text-muted">{m.hint}</span>
            </div>
            <span className="display text-right text-[34px]" style={{ color: tone }}>{dec3(team[m.key])}</span>
            <span className="text-right font-mono text-[15px] text-muted">{dec3(league[m.key])}</span>
            <span className="text-right font-mono text-[15px] font-medium">{ordinal(rank)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Two teams' four factors as paired bars. */
export function FactorPairs({ a, b, fa, fb }: { a: string; b: string; fa: Factors; fb: Factors }) {
  const max: Record<keyof Factors, number> = { efg: 0.62, tov: 0.16, orb: 0.34, ftr: 0.28 };
  return (
    <div className="flex flex-col gap-6">
      {FACTOR_META.map((m) => (
        <div key={m.key} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="display text-[24px] font-extrabold tracking-[0.03em]">{m.label}</span>
            <span className="font-mono text-[12px] text-muted">{m.hint}</span>
          </div>
          {[{ t: a, v: fa[m.key], c: "var(--accent)" }, { t: b, v: fb[m.key], c: "var(--ink)" }].map((row) => (
            <div key={row.t} className="grid grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-3">
              <span className="font-mono text-[13px] font-medium">{row.t}</span>
              <div className="relative h-5 bg-soft"><div className="absolute inset-y-0 left-0" style={{ width: `${(row.v / max[m.key]) * 100}%`, background: row.c }} /></div>
              <span className="display text-right text-[28px]">{dec3(row.v)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shot share and make rate by zone, for a team against a comparison (league or opponent). */
export function ZoneRows({ zones, compare, abbr, compareLabel }: { zones: Zone[]; compare: Zone[]; abbr: string; compareLabel: string }) {
  const cmp = new Map(compare.map((z) => [z.zone, z]));
  const rows = zones.filter((z) => z.zone !== "Backcourt");
  const max = Math.max(0.35, ...rows.map((z) => z.share), ...compare.map((z) => z.share));
  return (
    <div className="flex flex-col">
      <div className="label grid grid-cols-[minmax(120px,1fr)_minmax(0,1.4fr)_70px_70px] gap-3 border-b-[3px] border-ink pb-2">
        <span>Zone</span><span>Share of shots</span><span className="text-right">{abbr} FG%</span><span className="text-right">{compareLabel}</span>
      </div>
      {rows.map((z) => {
        const c = cmp.get(z.zone);
        return (
          <div key={z.zone} className="grid grid-cols-[minmax(120px,1fr)_minmax(0,1.4fr)_70px_70px] items-center gap-3 border-b border-line py-3">
            <span className="display text-[20px] font-extrabold leading-tight tracking-[0.03em]">{zoneName(z.zone)}</span>
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

/** Back-to-backs per team per month. Darker means more. */
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
      <div className="label grid grid-cols-[52px_repeat(7,minmax(0,1fr))_44px] gap-[3px] border-b-[3px] border-ink pb-2 text-center">
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
                  background: n === 0 ? "var(--soft)" : `color-mix(in srgb, var(--accent) ${Math.round(18 + share * 82)}%, white)`,
                  color: share > 0.55 ? "var(--accent-ink)" : "var(--ink)",
                }}
              >
                {n}
              </div>
            );
          })}
          <span className="text-center font-mono text-[13px] font-medium">{r.total}</span>
        </div>
      ))}
    </div>
  );
}

/** Half-court heatmap of where a player shoots from, built from 5-foot squares and softened with a blur. */
export function ShotHeatmap({ bins }: { bins: [number, number, number, number][] }) {
  const peak = Math.max(1, ...bins.map((b) => b[2]));
  const line = "var(--panel-grid)";
  return (
    <svg viewBox="0 0 500 353" className="block h-auto w-full" role="img" aria-label="Shot location heatmap">
      <defs>
        <filter id="heat-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="16" /></filter>
        <clipPath id="court-clip"><rect x="1" y="1" width="498" height="351" /></clipPath>
      </defs>
      <g clipPath="url(#court-clip)">
        <g filter="url(#heat-blur)">
          {bins.filter((b) => b[2] >= 2).map(([x, y, a]) => {
            const t = Math.sqrt(a / peak);
            return (
              <circle
                key={`${x},${y}`}
                cx={x + 275}
                cy={300 - y - 25}
                r={22 + t * 22}
                fill="var(--accent)"
                opacity={Math.min(1, 0.1 + t * 1.2)}
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
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 font-mono text-[12px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2">
          <span className={cn("inline-block h-3 w-3")} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
