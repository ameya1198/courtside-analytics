"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceDot, ReferenceLine,
  Scatter, ScatterChart, XAxis, YAxis, ZAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const axis = { tickLine: false, axisLine: false, tick: { fontFamily: "var(--font-mono)", fontSize: 12 } } as const;

/** Share of shots that were threes, one bar per season. The latest season takes the accent colour. */
export function ThreeRateChart({ data }: { data: { label: string; rate: number }[] }) {
  const config = { rate: { label: "Three-point share", color: "var(--panel-ink)" } } satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, pct: Math.round(d.rate * 1000) / 10 }));
  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <BarChart data={rows} margin={{ top: 28, right: 4, left: 4, bottom: 0 }}>
        <XAxis dataKey="label" {...axis} interval={0} tickMargin={10} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator formatter={(v) => `${v}% of shots`} />} />
        <Bar dataKey="pct" radius={0} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell key={r.label} fill={i === rows.length - 1 ? "var(--accent)" : "var(--panel-dot)"} />
          ))}
          <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`} className="fill-[var(--panel-ink)] font-mono text-[12px]" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Rolling 10-game average margin with the high and low marked. */
export function RollingMarginChart({ data }: { data: { game: number; value: number; date: string }[] }) {
  const config = { value: { label: "10-game margin", color: "var(--accent)" } } satisfies ChartConfig;
  const low = data.reduce((a, b) => (b.value < a.value ? b : a), data[0]);
  const high = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  return (
    <ChartContainer config={config} className="aspect-auto h-[340px] w-full">
      <LineChart data={data} margin={{ top: 28, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--panel-grid)" />
        <XAxis dataKey="game" {...axis} tickFormatter={(g) => `G${g}`} minTickGap={24} />
        <YAxis {...axis} width={44} tickFormatter={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <ReferenceLine y={0} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, p) => `Game ${p?.[0]?.payload?.game} · ${p?.[0]?.payload?.date}`} />}
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

/** Points in each recent game. Wins in the accent colour, losses in the warning colour. */
export function GameBarsChart({ data, average }: { data: { label: string; pts: number; win: boolean; tip: string }[]; average: number }) {
  const config = { pts: { label: "Points", color: "var(--accent)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="label" {...axis} interval={0} tickMargin={8} tick={{ ...axis.tick, fontSize: 10 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => p?.[0]?.payload?.tip} />} />
        <ReferenceLine y={average} stroke="var(--panel-ink)" strokeDasharray="6 4" />
        <Bar dataKey="pts" isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.win ? "var(--accent)" : "var(--warn)"} />
          ))}
          <LabelList dataKey="pts" position="top" className="fill-[var(--panel-ink)] font-mono text-[11px]" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Points per 36 against true shooting for every qualified player, with the selected one highlighted. */
export function VolumeEfficiencyChart({
  points, selected,
}: { points: { id: number; name: string; team: string; p36: number; ts: number }[]; selected?: number }) {
  const config = { ts: { label: "True shooting", color: "var(--panel-dot)" } } satisfies ChartConfig;
  const others = points.filter((p) => p.id !== selected).map((p) => ({ ...p, tsPct: Math.round(p.ts * 1000) / 10 }));
  const me = points.filter((p) => p.id === selected).map((p) => ({ ...p, tsPct: Math.round(p.ts * 1000) / 10 }));
  const xs = points.map((p) => p.p36), ys = points.map((p) => p.ts * 100);
  const x0 = Math.floor(Math.min(...xs) / 5) * 5, x1 = Math.ceil(Math.max(...xs) / 5) * 5;
  const y0 = Math.floor(Math.min(...ys) / 5) * 5, y1 = Math.ceil(Math.max(...ys) / 5) * 5;
  const step = (a: number, b: number) => Array.from({ length: (b - a) / 5 + 1 }, (_, i) => a + i * 5);
  return (
    <ChartContainer config={config} className="aspect-auto h-[380px] w-full">
      <ScatterChart margin={{ top: 24, right: 16, left: 0, bottom: 16 }}>
        <CartesianGrid stroke="var(--panel-grid)" />
        <XAxis type="number" dataKey="p36" name="Points per 36" {...axis} domain={[x0, x1]} ticks={step(x0, x1)}
          label={{ value: "POINTS PER 36 MINUTES", position: "insideBottom", offset: -12, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <YAxis type="number" dataKey="tsPct" name="True shooting" {...axis} width={44} domain={[y0, y1]} ticks={step(y0, y1)} tickFormatter={(v) => `${v}%`} />
        <ZAxis range={[36, 36]} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => `${p?.[0]?.payload?.name} · ${p?.[0]?.payload?.team}`}
            formatter={(_, __, item) => `${item.payload.p36} pts/36 · ${item.payload.tsPct}% TS`} />}
        />
        <Scatter data={others} fill="var(--panel-dot)" fillOpacity={0.85} isAnimationActive={false} />
        <Scatter data={me} fill="var(--accent)" stroke="var(--panel-ink)" strokeWidth={3} isAnimationActive={false} shape="circle">
          <LabelList dataKey="name" position="left" offset={14} className="fill-[var(--panel-ink)] font-[family-name:var(--font-display)] text-[20px] font-extrabold uppercase" />
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}

/** Win rate by days of rest. */
export function RestBucketsChart({ data }: { data: { label: string; win: number; margin: number; games: number }[] }) {
  const config = { win: { label: "Win rate", color: "var(--panel-ink)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <BarChart data={data} margin={{ top: 40, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="label" {...axis} interval={0} tickMargin={10} tick={{ ...axis.tick, fontSize: 13 }} />
        <YAxis hide domain={[0, 60]} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator
          formatter={(_, __, item) => `${item.payload.win}% wins · ${item.payload.margin > 0 ? "+" : ""}${item.payload.margin} margin · ${item.payload.games.toLocaleString()} games`} />} />
        <Bar dataKey="win" isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={i === 0 ? "var(--warn)" : "var(--panel-dot)"} />
          ))}
          <LabelList dataKey="win" position="top" formatter={(v: number) => `${v}%`} className="fill-[var(--panel-ink)] font-[family-name:var(--font-display)] text-[34px] font-black" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Salary against production, split into four corners by the medians. */
export function SalaryQuadrantChart({
  points, medianSalary, medianProduction, highlight,
}: {
  points: { id: number; name: string; team: string; salaryM: number; fppg: number }[];
  medianSalary: number; medianProduction: number; highlight: number[];
}) {
  const config = { fppg: { label: "Fantasy points per game", color: "var(--panel-dot)" } } satisfies ChartConfig;
  const hot = new Set(highlight);
  const rest = points.filter((p) => !hot.has(p.id));
  // Keep the caller's order, so the first highlighted player gets the label.
  const marked = highlight.map((id) => points.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const xMax = Math.ceil(Math.max(...points.map((p) => p.salaryM)) / 10) * 10;
  const yMax = Math.ceil(Math.max(...points.map((p) => p.fppg)) / 10) * 10;
  return (
    <ChartContainer config={config} className="aspect-auto h-[460px] w-full">
      <ScatterChart margin={{ top: 24, right: 24, left: 0, bottom: 20 }}>
        <CartesianGrid stroke="var(--panel-grid)" />
        <XAxis type="number" dataKey="salaryM" {...axis} domain={[0, xMax]} tickFormatter={(v) => `$${v}M`}
          label={{ value: "SALARY", position: "insideBottom", offset: -14, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <YAxis type="number" dataKey="fppg" {...axis} width={44} domain={[0, yMax]}
          label={{ value: "FANTASY PTS / GAME", angle: -90, position: "insideLeft", offset: 12, fill: "var(--panel-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <ZAxis range={[36, 36]} />
        <ReferenceLine x={medianSalary} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ReferenceLine y={medianProduction} stroke="var(--panel-muted)" strokeDasharray="4 4" />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => `${p?.[0]?.payload?.name} · ${p?.[0]?.payload?.team}`}
            formatter={(_, __, item) => `$${item.payload.salaryM.toFixed(1)}M · ${item.payload.fppg} fantasy pts a game`} />}
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

/** Average production by age across every season we hold. */
export function AgeCurveChart({ data, peak }: { data: { age: number; fppg: number; players: number }[]; peak: number }) {
  const config = { fppg: { label: "Fantasy points per game", color: "var(--panel-ink)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="age" {...axis} interval={0} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => `Age ${p?.[0]?.payload?.age}`}
          formatter={(_, __, item) => `${item.payload.fppg} fantasy pts a game · ${item.payload.players} player-seasons`} />} />
        <Bar dataKey="fppg" isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.age} fill={d.age === peak ? "var(--accent)" : "var(--panel-dot)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
