"use client";

import { useEffect, useRef } from "react";

import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceDot, ReferenceLine,
  Scatter, ScatterChart, XAxis, YAxis, ZAxis,
} from "recharts";
import {
  Activity, BatteryLow, BedDouble, CalendarDays, CircleDollarSign, CircleX, Crosshair, Flame, Hand, Handshake, History, House,
  Medal, Scale, Swords, Target, Trophy, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import { lastName } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig, type TooltipRow } from "@/components/ui/chart";

const axis = { tickLine: false, axisLine: false, tick: { fontFamily: "var(--font-mono)", fontSize: 12 } } as const;
// Bar charts follow the shadcn "bar chart" layout: no axis lines, labels 10px below the bars.
const barAxis = { ...axis, tickMargin: 10 } as const;
// Tooltips jump to each new point instead of sliding there: Recharts' default 400ms slide made them lag and wobble.
const tip = { isAnimationActive: false } as const;
const signedNum = (v: number) => `${v > 0 ? "+" : ""}${v}`;
// Small value labels above vertical bars
const barLabel = { position: "top", offset: 6, className: "fill-[var(--ink)] font-mono text-[11px]" } as const;

/** Share of shots that were threes, one bar per season. The latest season takes the accent colour. */
export function ThreeRateChart({ data }: { data: { label: string; rate: number }[] }) {
  const config = { pct: { label: "Shots from three", color: "var(--panel-dot)", icon: Target } } satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, pct: Math.round(d.rate * 1000) / 10 }));
  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart accessibilityLayer data={rows} margin={{ top: 22 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis dataKey="label" {...barAxis} tickFormatter={(v: string) => v.slice(2)} />
        <ChartTooltip {...tip} cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.label}
          rows={(d) => [{ key: "pct", value: `${d.pct}%` }]} />} />
        <Bar dataKey="pct" fill="var(--color-pct)" radius={8} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell key={r.label} fill={i === rows.length - 1 ? "var(--accent)" : "var(--color-pct)"} />
          ))}
          <LabelList dataKey="pct" {...barLabel} formatter={(v: number) => `${v}%`} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Rolling 10-game average margin with the high and low marked. */
export function RollingMarginChart({ data }: { data: { game: number; value: number; date: string }[] }) {
  const config = { value: { label: "10-game margin", color: "var(--accent)", icon: Activity } } satisfies ChartConfig;
  const low = data.reduce((a, b) => (b.value < a.value ? b : a), data[0]);
  const high = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  return (
    <ChartContainer config={config} className="aspect-auto h-[340px] w-full">
      <LineChart data={data} margin={{ top: 28, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis dataKey="game" {...axis} tickFormatter={(g) => `G${g}`} minTickGap={24} />
        <YAxis {...axis} width={44} tickFormatter={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <ReferenceLine y={0} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ChartTooltip
          {...tip}
          content={<ChartTooltipContent labelFormatter={(_, p) => `Game ${p?.[0]?.payload?.game} · ${p?.[0]?.payload?.date}`}
            rows={(d) => [{ key: "value", value: signedNum(d.value) }]} />}
        />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={4} dot={false} isAnimationActive={false} />
        <ReferenceDot x={high.game} y={high.value} r={7} fill="var(--panel-ink)" stroke="none"
          label={{ value: `HIGH ${high.value > 0 ? "+" : ""}${high.value} · G${high.game}`, position: "top", fill: "var(--panel-ink)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }} />
        <ReferenceDot x={low.game} y={low.value} r={7} fill="var(--panel-ink)" stroke="none"
          label={{ value: `LOW ${low.value > 0 ? "+" : ""}${low.value} · G${low.game}`, position: "bottom", fill: "var(--panel-ink)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }} />
      </LineChart>
    </ChartContainer>
  );
}

/** Rolling defensive rating. Lower is better, so the league line is the bar to stay under. */
export function DefRatingChart({ data, league }: { data: { game: number; value: number; date: string }[]; league: number }) {
  const config = { value: { label: "10-game defensive rating", color: "var(--accent)" } } satisfies ChartConfig;
  const best = data.reduce((a, b) => (b.value < a.value ? b : a), data[0]);
  const worst = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  const lo = Math.floor(Math.min(best.value, league) - 3), hi = Math.ceil(Math.max(worst.value, league) + 3);
  return (
    <ChartContainer config={config} className="aspect-auto h-[340px] w-full">
      <LineChart data={data} margin={{ top: 28, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis dataKey="game" {...axis} tickFormatter={(g) => `G${g}`} minTickGap={24} />
        <YAxis {...axis} width={44} domain={[lo, hi]} />
        <ReferenceLine y={league} stroke="var(--panel-muted)" strokeDasharray="4 4"
          label={{ value: `LEAGUE ${league}`, position: "insideTopRight", fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `Game ${p?.[0]?.payload?.game} · ${p?.[0]?.payload?.date}`} />} />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={4} dot={false} isAnimationActive={false} />
        <ReferenceDot x={best.game} y={best.value} r={7} fill="var(--panel-ink)" stroke="none"
          label={{ value: `BEST ${best.value} · G${best.game}`, position: "bottom", fill: "var(--panel-ink)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }} />
        <ReferenceDot x={worst.game} y={worst.value} r={7} fill="var(--warn)" stroke="none"
          label={{ value: `WORST ${worst.value} · G${worst.game}`, position: "top", fill: "var(--panel-ink)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }} />
      </LineChart>
    </ChartContainer>
  );
}

/** Points in each recent game. Wins in the accent colour, losses in the warning colour. Dashed line = season average. */
export function GameBarsChart({ data, average }: {
  data: { label: string; pts: number; win: boolean; tip: string; reb: number; ast: number }[]; average: number;
}) {
  const config = {
    pts: { label: "Points", color: "var(--accent)", icon: Flame },
    result: { label: "Result", icon: Trophy },
    reb: { label: "Rebounds", icon: Hand },
    ast: { label: "Assists", icon: Handshake },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 22 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis dataKey="label" {...barAxis} interval={0} tick={{ ...barAxis.tick, fontSize: 10 }} />
        <ChartTooltip {...tip} cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.tip}
          rows={(d) => [
            { key: "result", value: d.win ? "Win" : "Loss", icon: d.win ? Trophy : CircleX },
            { key: "pts", value: d.pts }, { key: "reb", value: d.reb }, { key: "ast", value: d.ast },
          ]} />} />
        <ReferenceLine y={average} stroke="var(--panel-muted)" strokeDasharray="6 4" />
        <Bar dataKey="pts" fill="var(--color-pts)" radius={8} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.win ? "var(--color-pts)" : "var(--warn)"} />
          ))}
          <LabelList dataKey="pts" {...barLabel} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Points per 36 against true shooting for every qualified player, with the selected one highlighted. */
export function VolumeEfficiencyChart({
  points, selected,
}: { points: { id: number; name: string; team: string; p36: number; ts: number }[]; selected?: number }) {
  const config = {
    ts: { label: "True shooting", color: "var(--panel-dot)", icon: Crosshair },
    p36: { label: "Points per 36", icon: Flame },
  } satisfies ChartConfig;
  const others = points.filter((p) => p.id !== selected).map((p) => ({ ...p, tsPct: Math.round(p.ts * 1000) / 10 }));
  const me = points.filter((p) => p.id === selected).map((p) => ({ ...p, tsPct: Math.round(p.ts * 1000) / 10 }));
  const xs = points.map((p) => p.p36), ys = points.map((p) => p.ts * 100);
  const x0 = Math.floor(Math.min(...xs) / 5) * 5, x1 = Math.ceil(Math.max(...xs) / 5) * 5;
  const y0 = Math.floor(Math.min(...ys) / 5) * 5, y1 = Math.ceil(Math.max(...ys) / 5) * 5;
  const step = (a: number, b: number) => Array.from({ length: (b - a) / 5 + 1 }, (_, i) => a + i * 5);
  return (
    <ChartContainer config={config} className="aspect-auto h-[380px] w-full">
      <ScatterChart margin={{ top: 24, right: 16, left: 0, bottom: 16 }}>
        <CartesianGrid stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis type="number" dataKey="p36" name="Points per 36" {...axis} domain={[x0, x1]} ticks={step(x0, x1)}
          label={{ value: "POINTS PER 36 MINUTES", position: "insideBottom", offset: -12, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <YAxis type="number" dataKey="tsPct" name="True shooting" {...axis} width={44} domain={[y0, y1]} ticks={step(y0, y1)} tickFormatter={(v) => `${v}%`} />
        <ZAxis range={[36, 36]} />
        <ChartTooltip
          cursor={false}
          {...tip}
          content={<ChartTooltipContent labelFormatter={(_, p) => `${p?.[0]?.payload?.name} · ${p?.[0]?.payload?.team}`}
            rows={(d) => [{ key: "p36", value: d.p36 }, { key: "ts", value: `${d.tsPct}%` }]} />}
        />
        <Scatter data={others} fill="var(--panel-dot)" fillOpacity={0.85} isAnimationActive={false} />
        <Scatter data={me} fill="var(--accent)" stroke="var(--panel-ink)" strokeWidth={3} isAnimationActive={false} shape="circle">
          <LabelList dataKey="name" position="left" offset={14} className="fill-[var(--panel-ink)] font-[family-name:var(--font-display)] text-[20px] font-extrabold uppercase" />
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}

/** Win rate by days of rest. The back-to-back bar takes the warning colour. */
export function RestBucketsChart({ data }: { data: { label: string; win: number; margin: number; games: number; league?: number }[] }) {
  const config = {
    win: { label: "Win rate", color: "var(--panel-dot)", icon: Trophy },
    margin: { label: "Margin", icon: Scale },
    games: { label: "Games", icon: CalendarDays },
    league: { label: "League win rate", icon: Users },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 22 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis dataKey="label" {...barAxis} />
        <ChartTooltip {...tip} cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.label}
          rows={(d) => [
            { key: "win", value: `${d.win}%` },
            { key: "margin", value: signedNum(d.margin) },
            { key: "games", value: d.games.toLocaleString() },
            ...(d.league !== undefined ? [{ key: "league", value: `${d.league}%` }] : []),
          ]} />} />
        <Bar dataKey="win" fill="var(--color-win)" radius={8} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={i === 0 ? "var(--warn)" : "var(--color-win)"} />
          ))}
          <LabelList dataKey="win" {...barLabel} formatter={(v: number) => `${v}%`} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Salary against production, split into four corners by the medians. */
export function SalaryQuadrantChart({
  points, medianSalary, medianProduction, highlight,
}: {
  points: { id: number; name: string; team: string; salaryM: number; ws: number; perWs: number | null }[];
  medianSalary: number; medianProduction: number; highlight: number[];
}) {
  const config = {
    ws: { label: "Win Shares", color: "var(--panel-dot)", icon: Trophy },
    salary: { label: "Salary", icon: CircleDollarSign },
    perWs: { label: "$ per Win Share", icon: Scale },
  } satisfies ChartConfig;
  const hot = new Set(highlight);
  const rest = points.filter((p) => !hot.has(p.id));
  // Keep the caller's order, so the first highlighted player gets the label.
  const marked = highlight.map((id) => points.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const xMax = Math.ceil(Math.max(...points.map((p) => p.salaryM)) / 10) * 10;
  // Win Shares can dip below zero for players who hurt their team
  const yMax = Math.ceil(Math.max(...points.map((p) => p.ws)) / 5) * 5;
  const yMin = Math.min(0, Math.floor(Math.min(...points.map((p) => p.ws))));
  return (
    <ChartContainer config={config} className="aspect-auto h-[460px] w-full">
      <ScatterChart margin={{ top: 24, right: 24, left: 0, bottom: 20 }}>
        <CartesianGrid stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis type="number" dataKey="salaryM" {...axis} domain={[0, xMax]} tickFormatter={(v) => `$${v}M`}
          label={{ value: "SALARY", position: "insideBottom", offset: -14, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <YAxis type="number" dataKey="ws" {...axis} width={44} domain={[yMin, yMax]}
          label={{ value: "WIN SHARES", angle: -90, position: "insideLeft", offset: 12, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <ZAxis range={[36, 36]} />
        <ReferenceLine x={medianSalary} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ReferenceLine y={medianProduction} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ChartTooltip
          cursor={false}
          {...tip}
          content={<ChartTooltipContent labelFormatter={(_, p) => `${p?.[0]?.payload?.name} · ${p?.[0]?.payload?.team}`}
            rows={(d) => [
              { key: "salary", value: `$${d.salaryM.toFixed(1)}M` }, { key: "ws", value: d.ws.toFixed(1) },
              { key: "perWs", value: d.perWs ? `$${Math.round(d.perWs).toLocaleString()}` : "No wins" },
            ]} />}
        />
        <Scatter data={rest} fill="var(--panel-dot)" fillOpacity={0.8} isAnimationActive={false} />
        <Scatter data={marked.slice(1)} fill="var(--accent)" stroke="var(--panel-ink)" strokeWidth={2} isAnimationActive={false} />
        <Scatter data={marked.slice(0, 1)} fill="var(--accent)" stroke="var(--panel-ink)" strokeWidth={2} isAnimationActive={false}>
          <LabelList dataKey="name" position="top" offset={12} className="fill-[var(--panel-ink)] font-mono text-[12px]" />
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}

/** Average production by age across every season we hold. The peak age takes the accent colour. */
export function AgeCurveChart({ data, peak }: { data: { age: number; ws48: number; players: number }[]; peak: number }) {
  const config = {
    ws48: { label: "Win Shares per 48", color: "var(--panel-dot)", icon: Trophy },
    players: { label: "Player-seasons", icon: Users },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 22 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis dataKey="age" {...barAxis} interval={0} />
        <ChartTooltip {...tip} cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => `Age ${p?.[0]?.payload?.age}`}
          rows={(d) => [{ key: "ws48", value: d.ws48.toFixed(3).replace(/^0/, "") }, { key: "players", value: d.players }]} />} />
        <Bar dataKey="ws48" fill="var(--color-ws48)" radius={8} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.age} fill={d.age === peak ? "var(--accent)" : "var(--color-ws48)"} />
          ))}
          <LabelList dataKey="ws48" {...barLabel} formatter={(v: number) => v.toFixed(3).replace(/^0/, "")} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------------------------
// Horizontal bars, in the shadcn "Bar Chart - Horizontal" structure: a vertical-layout BarChart,
// the number axis hidden, category labels on the left, rounded bars. Each bar's value sits on a
// right-hand axis so it reads without hovering. Use inside a ChartCard for the header and footer.
// ---------------------------------------------------------------------------------------------

// Pages are server components and can only pass plain data here, so icons are passed by name.
const ICONS = {
  medal: Medal, "trending-up": TrendingUp, "trending-down": TrendingDown, history: History, calendar: CalendarDays,
  scale: Scale, "battery-low": BatteryLow, bed: BedDouble, trophy: Trophy, house: House,
} as const;
export type IconName = keyof typeof ICONS;

/** One bar. `tips` are extra tooltip rows shown under the value. */
/** An SVG axis label in the site's display font (big, condensed, uppercase), like the old HTML bar lists. */
function DisplayTick({ x, y, text, size, anchor }: { x: number; y: number; text: string; size: number; anchor: "start" | "end" }) {
  return (
    <text x={x} y={y} dy={size * 0.36} textAnchor={anchor} fill="var(--ink)"
      style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: size, letterSpacing: "0.03em" }}>
      {text.toUpperCase()}
    </text>
  );
}

type TickProps = { x: number; y: number; payload: { value: string } };

export type HBar = {
  key: string; label: string; value: number; valueText: string; fill?: string;
  tips?: { label: string; value: string; icon?: IconName }[];
};

export function HorizontalBarChart({
  data, name, icon, domain, refLine, categoryWidth = 64, rowHeight = 40, maxHeight, focusKey, labelSize = 20, bigValues = false, valueWidth,
}: {
  data: HBar[];
  /** Tooltip label for the value, e.g. "Percentile". */
  name: string;
  icon?: IconName;
  /** Defaults to 0 up to the largest value. Pass a symmetric range for bars that go both ways. */
  domain?: [number, number];
  /** A dashed reference line: 0 for diverging bars, 50 for "middle of the pack". */
  refLine?: number;
  categoryWidth?: number;
  rowHeight?: number;
  /** For long lists: cap the box at this height and scroll inside it. */
  maxHeight?: number;
  /** In a scrolling box, start with this row in view (e.g. the chosen team). */
  focusKey?: string;
  /** Font size of the row labels on the left (display font). */
  labelSize?: number;
  /** Show the values on the right as big display numbers (percentiles), not small mono text. */
  bigValues?: boolean;
  /** Room for the values on the right. Wider for labels like "27TH". */
  valueWidth?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const i = focusKey ? data.findIndex((d) => d.key === focusKey) : -1;
    if (box.current && maxHeight && i >= 0) box.current.scrollTop = Math.max(0, i * rowHeight - maxHeight / 2);
  }, [focusKey, data, rowHeight, maxHeight]);
  // The scroll box uses inline styles, not Tailwind classes, so it clips even before a stylesheet rebuild.
  const config = { value: { label: name, color: "var(--accent)", icon: icon ? ICONS[icon] : undefined } } satisfies ChartConfig;
  const byKey = new Map(data.map((d) => [d.key, d]));
  return (
    <div ref={box} style={maxHeight ? { maxHeight, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingRight: 4 } : undefined}>
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * rowHeight + 8 }}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 0 }}>
        <XAxis type="number" dataKey="value" hide domain={domain ?? [0, "dataMax"]} />
        <YAxis dataKey="key" type="category" {...axis} tickMargin={10} width={categoryWidth} interval={0}
          tick={(t: TickProps) => <DisplayTick x={t.x} y={t.y} anchor="end" size={labelSize} text={byKey.get(t.payload.value)?.label ?? t.payload.value} />} />
        <YAxis yAxisId="value" orientation="right" dataKey="key" type="category" {...axis} tickMargin={8} width={valueWidth ?? (bigValues ? 64 : 72)} interval={0}
          {...(bigValues
            ? { tick: (t: TickProps) => <DisplayTick x={t.x} y={t.y} anchor="start" size={30} text={byKey.get(t.payload.value)?.valueText ?? ""} /> }
            : { tickFormatter: (k: string) => byKey.get(k)?.valueText ?? "" })} />
        {refLine !== undefined ? <ReferenceLine x={refLine} stroke="var(--panel-muted)" strokeDasharray="4 4" /> : null}
        <ChartTooltip {...tip} cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.label}
          rows={(d) => [
            { key: "value", value: d.valueText },
            ...((d as HBar).tips ?? []).map((t, i): TooltipRow => ({ key: `tip${i}`, label: t.label, value: t.value, icon: t.icon ? ICONS[t.icon] : undefined })),
          ]} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={5} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.key} fill={d.fill ?? "var(--color-value)"} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
    </div>
  );
}

/** Two teams side by side per row (Matchup four factors). Bar length is scaled per row, labels show the real value. */
export function PairedHorizontalBarChart({
  data, a, b, rowHeight = 64,
}: {
  data: { key: string; label: string; a: number; b: number; aText: string; bText: string; scale: number }[];
  a: string; b: string; rowHeight?: number;
}) {
  const config = {
    aN: { label: a, color: "var(--accent)", icon: Flame },
    // --opp is the opponent colour on the Matchup page; other pages keep ink
    bN: { label: b, color: "var(--opp, var(--ink))", icon: Swords },
  } satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, aN: d.a / d.scale, bN: d.b / d.scale }));
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * rowHeight + 8 }}>
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 48 }} barGap={3}>
        <XAxis type="number" hide domain={[0, 1]} />
        <YAxis dataKey="label" type="category" {...axis} tickMargin={10} width={96} />
        <ChartTooltip {...tip} cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.label}
          rows={(d) => [{ key: "aN", value: d.aText }, { key: "bN", value: d.bText }]} />} />
        <Bar dataKey="aN" fill="var(--color-aN)" radius={5} isAnimationActive={false}>
          <LabelList dataKey="aText" position="right" offset={8} className="fill-[var(--ink)] font-mono text-[12px]" />
        </Bar>
        <Bar dataKey="bN" fill="var(--color-bN)" radius={5} isAnimationActive={false}>
          <LabelList dataKey="bText" position="right" offset={8} className="fill-[var(--ink)] font-mono text-[12px]" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Small rolling-average line for one Roster Needs measure, against a dashed league-average line. */
export function NeedTrendChart({ data, league, label, format }: {
  data: { g: number; value: number; date: string }[];
  league: number;
  label: string;
  /** "pct" shows 0.223 as 22.3%, "dec3" as .223, "num" as 12.3 */
  format: "pct" | "dec3" | "num";
}) {
  const fmt = (v: number) => (format === "pct" ? `${(v * 100).toFixed(1)}%` : format === "dec3" ? v.toFixed(3).replace(/^0/, "") : v.toFixed(1));
  const config = { value: { label, color: "var(--accent)", icon: Activity } } satisfies ChartConfig;
  const vals = [...data.map((d) => d.value), league];
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.15 || 0.01;
  const last = data[data.length - 1];
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 150 }}>
      <LineChart data={data} margin={{ top: 14, right: 12, left: 12, bottom: 0 }}>
        <XAxis dataKey="g" hide />
        <YAxis hide domain={[Math.min(...vals) - pad, Math.max(...vals) + pad]} />
        <ReferenceLine y={league} stroke="var(--panel-muted)" strokeDasharray="4 4"
          label={{ value: `LEAGUE ${fmt(league)}`, position: "insideTopRight", fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 10 }} />
        <ChartTooltip {...tip} content={<ChartTooltipContent labelFormatter={(_, p) => `Games ${Math.max(1, (p?.[0]?.payload?.g ?? 10) - 9)}-${p?.[0]?.payload?.g} · to ${p?.[0]?.payload?.date}`}
          rows={(d) => [{ key: "value", value: fmt(d.value) }]} />} />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={3} dot={false} isAnimationActive={false} />
        {last ? <ReferenceDot x={last.g} y={last.value} r={5} fill="var(--accent)" stroke="none" /> : null}
      </LineChart>
    </ChartContainer>
  );
}

/** Roster Needs: how well each candidate fits the team's holes, against his salary. Top left is the most fit for the money. */
export function FitScatterChart({ points, highlight, medianSalary, medianFit }: {
  points: { id: number; name: string; team: string; salaryM: number; fit: number }[];
  highlight: number[];
  medianSalary: number;
  medianFit: number;
}) {
  const config = {
    fit: { label: "Fit", color: "var(--panel-dot)", icon: Target },
    salary: { label: "Salary", icon: CircleDollarSign },
  } satisfies ChartConfig;
  const hot = new Set(highlight);
  const rest = points.filter((p) => !hot.has(p.id));
  const xMax = Math.ceil(Math.max(10, ...points.map((p) => p.salaryM)) / 10) * 10;
  // Label placement, worked out in chart units: names in the right quarter go left of the dot, and a name that
  // would sit on one already placed is dropped (hovering still names the dot). Highlight order = priority.
  const placed: { x0: number; x1: number; fit: number }[] = [];
  const marked = highlight.map((id) => points.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p)).map((p) => {
    const short = lastName(p.name).toUpperCase();
    const w = (short.length * 7.5 + 14) / 560 * xMax; // label width in salary units, for a ~560px wide chart
    const left = p.salaryM > xMax * 0.72;
    const x0 = left ? p.salaryM - w : p.salaryM, x1 = left ? p.salaryM : p.salaryM + w;
    const clash = placed.some((q) => Math.abs(q.fit - p.fit) < 4.5 && x0 < q.x1 && q.x0 < x1);
    if (!clash) placed.push({ x0, x1, fit: p.fit });
    return { ...p, short: clash ? "" : short, left };
  });
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 420 }}>
      <ScatterChart margin={{ top: 24, right: 28, left: 0, bottom: 20 }}>
        <CartesianGrid stroke="var(--panel-grid)" strokeDasharray="3 3" strokeOpacity={0.7} />
        <XAxis type="number" dataKey="salaryM" {...axis} domain={[0, xMax]} tickFormatter={(v) => `$${v}M`}
          label={{ value: "SALARY", position: "insideBottom", offset: -14, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <YAxis type="number" dataKey="fit" {...axis} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
          label={{ value: "FIT", angle: -90, position: "insideLeft", offset: 12, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <ZAxis range={[40, 40]} />
        <ReferenceLine x={medianSalary} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ReferenceLine y={medianFit} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ChartTooltip cursor={false} {...tip}
          content={<ChartTooltipContent labelFormatter={(_, p) => `${p?.[0]?.payload?.name} · ${p?.[0]?.payload?.team}`}
            rows={(d) => [{ key: "fit", value: String(d.fit) }, { key: "salary", value: `$${d.salaryM.toFixed(1)}M` }]} />} />
        <Scatter data={rest} fill="var(--panel-dot)" fillOpacity={0.75} isAnimationActive={false} />
        <Scatter data={marked} fill="var(--accent)" stroke="var(--paper)" strokeWidth={2} isAnimationActive={false}>
          <LabelList dataKey="short" content={(p) => {
            const { x, y, index, value } = p as { x: number; y: number; index: number; value: string };
            if (!value) return null;
            const left = marked[index]?.left;
            return (
              <text x={x + 6 + (left ? -12 : 12)} y={y + 6} dy={4} textAnchor={left ? "end" : "start"} fill="var(--panel-ink)"
                style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{value}</text>
            );
          }} />
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}
