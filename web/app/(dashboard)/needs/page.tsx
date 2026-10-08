import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Heading, Section, Wrap } from "@/components/blocks";
import { ChartCard } from "@/components/chart-card";
import { HeatLegend, Legend, heatColor } from "@/components/charts/html";
import { FitScatterChart, HorizontalBarChart, NeedTrendChart, PairedHorizontalBarChart } from "@/components/charts/recharts";
import { Hero } from "@/components/hero";
import { ParamSelect } from "@/components/param-select";
import { pageData } from "@/lib/db";
import { lastName, one, ordinal, parseSeason, seasonOptions } from "@/lib/format";
import { cap, money } from "@/lib/insights";
import { myTeam } from "@/lib/my-team";
import { NEEDS, NEED_ORDER, lower, type NeedKey } from "@/lib/needs";
import { logoUrl, opponentColor, teamTheme } from "@/lib/teams";
import type { Candidate, NeedsData, TeamNeed } from "@/lib/types";

export const metadata: Metadata = { title: "Roster Needs" };
export const revalidate = 3600;

type Params = Record<string, string | string[] | undefined>;

const SIDES = [["offense", "Offense"], ["defense", "Defense"], ["both", "Both"]] as const;
const LISTS = [["targets", "Trade targets"], ["free", "Free agents"], ["bargains", "Bargains"]] as const;
const STARS = [["0", "Realistic"], ["1", "Show stars"]] as const;
const SALARY: Record<string, { label: string; min: number; max: number }> = {
  any: { label: "Any", min: 0, max: Infinity },
  u5: { label: "Under $5M", min: 0, max: 5e6 },
  "5-15": { label: "$5-15M", min: 5e6, max: 15e6 },
  "15-30": { label: "$15-30M", min: 15e6, max: 30e6 },
  "30": { label: "$30M+", min: 30e6, max: Infinity },
};
const AGES: Record<string, { label: string; min: number; max: number }> = {
  any: { label: "Any", min: 0, max: 99 },
  u25: { label: "Under 25", min: 0, max: 24.99 },
  "25-30": { label: "25-30", min: 25, max: 30 },
  "30": { label: "Over 30", min: 30.01, max: 99 },
};
// Bargains are good fits on small contracts
const BARGAIN_MAX = 10e6;
const WORDS = ["", "one", "two", "three"];
// Inline grid styles, so the table holds its columns even before a stylesheet rebuild
const TARGET_COLS = { gridTemplateColumns: "28px minmax(220px,1.4fr) minmax(140px,0.8fr) minmax(230px,1.5fr) 84px 92px 84px 56px 44px" };

// "A", "A and B", "A, B and C"
const listNames = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// "2027-28" for a contract whose last season starts in 2027
const seasonName = (start: number) => `${start}-${String((start + 1) % 100).padStart(2, "0")}`;

function Tag({ tone, title, children }: { tone: "warn" | "ink" | "accent"; title?: string; children: React.ReactNode }) {
  const style = tone === "warn" ? { background: "#fdece4", color: "var(--warn)" }
    : tone === "accent" ? { background: "color-mix(in srgb, var(--accent) 14%, white)", color: "var(--accent)" }
    : { background: "var(--soft)", color: "var(--ink)" };
  return <span title={title} className="whitespace-nowrap rounded-full uppercase" style={{ ...style, padding: "1px 6px", fontSize: 10, letterSpacing: "0.08em" }}>{children}</span>;
}

const fmtPerWs = (v: number | null) => (v === null ? "-" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const trendFormat = (k: NeedKey) => (k === "ft_rate" ? "dec3" : NEEDS[k].fmt(0.5).endsWith("%") ? "pct" : "num") as "pct" | "dec3" | "num";

/** Links that swap one URL param, styled like the hero dropdowns. */
function Toggle({ name, value, options, sp, tone = "hero" }: {
  name: string; value: string; options: readonly (readonly [string, string])[]; sp: Params; tone?: "hero" | "page";
}) {
  const href = (v: string) => {
    const next = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (typeof val === "string" && k !== name) next.set(k, val);
    next.set(name, v);
    return `/needs?${next.toString()}`;
  };
  return (
    <div className="label inline-flex border-2 border-current" style={{ borderColor: tone === "page" ? "var(--ink)" : undefined }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Link key={v} href={href(v)} scroll={false} aria-current={on ? "true" : undefined} style={{ padding: "8px 14px", ...(on ? (tone === "page" ? { background: "var(--ink)", color: "var(--paper)" } : { background: "var(--hero-ink)", color: "var(--hero)" }) : {}) }}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function Chip({ need, pct }: { need: NeedKey; pct: number | null | undefined }) {
  const strong = (pct ?? 0) >= 70;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px]"
      style={strong ? { background: "color-mix(in srgb, var(--accent) 14%, white)", color: "var(--accent)" } : { background: "var(--soft)", color: "var(--muted)" }}>
      {NEEDS[need].short} <b className="font-medium">{pct ?? "-"}</b>
    </span>
  );
}

export default async function RosterNeeds({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const mine = await myTeam();
  if (!mine) return <Wrap className="py-20"><Empty>Pick a team first.</Empty></Wrap>;
  const side = (["offense", "defense", "both"].includes(one(sp.side) ?? "") ? one(sp.side) : "both") as NeedsData["side"];
  const listParam = one(sp.list);
  const stars = one(sp.stars) === "1";
  const salaryKey = SALARY[one(sp.salary) ?? ""] ? one(sp.salary)! : "any";
  const ageKey = AGES[one(sp.age) ?? ""] ? one(sp.age)! : "any";

  const d = await pageData<NeedsData>("needs", [parseSeason(sp.season), mine.abbr, side]);
  // Free agents only exist when we know today's rosters (last season or this one)
  const list = listParam === "bargains" ? "bargains" : listParam === "free" && d.rosterSeason ? "free" : "targets";
  if (!d.season || !d.needs.length || !d.holes.length) {
    return <Wrap className="py-20"><Empty>No team data for this season yet. Roster Needs starts once a team has played 20 games.</Empty></Wrap>;
  }

  const byNeed = new Map(d.needs.map((n) => [n.need, n]));
  const holes = d.holes.map((k) => byNeed.get(k)!).filter(Boolean);
  const worst = holes[0];
  const realHoles = holes.filter((h) => h.rank > 20);
  // Strengths to keep: the team's two best-ranked needs that are not holes
  const strengths = [...d.needs].filter((n) => !d.holes.includes(n.need)).sort((a, b) => a.rank - b.rank).slice(0, 2);
  const valueLine = (n: TeamNeed) => `${NEEDS[n.need].fmt(n.value)} ${NEEDS[n.need].unit}. League average ${NEEDS[n.need].fmt(n.leagueAvg)}.`;

  // ----- Needs headline
  const needsTitle = realHoles.length
    ? `${mine.abbr}'s biggest hole is ${lower(worst.need)} (${ordinal(worst.rank)}).` +
      (holes.length > 1 ? ` ${cap(listNames(holes.slice(1).map((h) => `${lower(h.need)} (${ordinal(h.rank)})`)))} ${holes.length > 2 ? "are" : "is"} next.` : "")
    : `${mine.abbr} has no bottom-10 weakness${side === "both" ? "" : ` on ${side}`}. The weakest spot is ${lower(worst.need)} (${ordinal(worst.rank)}).`;

  // ----- Trends: last 10 games against the season, for each hole with game-by-game data
  const trends = holes.map((h) => {
    const series = d.trend.filter((r) => typeof r[h.need] === "number").map((r) => ({ g: r.g, date: r.date, value: r[h.need] as number }));
    const last = series.length ? series[series.length - 1].value : null;
    // Positive = better than the season number, in the direction that is good for this measure
    const change = last === null ? 0 : ((last - h.value) / Math.abs(h.value || 1)) * (h.higherIsBetter ? 1 : -1);
    return { h, series, last, change };
  });
  const slipping = trends.filter((t) => t.change < -0.04).sort((a, b) => a.change - b.change)[0];
  const improving = trends.filter((t) => t.change > 0.04).sort((a, b) => b.change - a.change)[0];
  const trendTitle = slipping
    ? `${cap(lower(slipping.h.need))} has slipped over the last 10 games: ${NEEDS[slipping.h.need].fmt(slipping.last!)}, against ${NEEDS[slipping.h.need].fmt(slipping.h.value)} for the season.`
    : improving
      ? `${cap(lower(improving.h.need))} is getting better: ${NEEDS[improving.h.need].fmt(improving.last!)} over the last 10 games, against ${NEEDS[improving.h.need].fmt(improving.h.value)} for the season.`
      : `The holes have held steady all season. They are not slumps, so they need a roster answer.`;

  // ----- Roster heatmap
  const cols: (NeedKey | null)[] = [...d.holes, null, ...NEED_ORDER.filter((k) => !d.holes.includes(k))];
  const covering = d.roster.filter((r) => (r.pcts?.[worst.need] ?? 0) >= 60);
  const heatTitle = !covering.length
    ? `No ${mine.name} player is above the 60th percentile in ${lower(worst.need)}. It's a missing skill, not a minutes problem.`
    : covering.length === 1 && covering[0].mpg < 26
      ? `Only ${covering[0].name} is above the 60th percentile in ${lower(worst.need)}, and he plays ${Math.round(covering[0].mpg)} minutes. Add that skill or play him more.`
      : `${listNames(covering.map((r) => lastName(r.name)).slice(0, 3))} cover ${lower(worst.need)}, yet the team ranks ${ordinal(worst.rank)}. Look at lineups before trading.`;

  // ----- Targets
  const sal = SALARY[salaryKey], age = AGES[ageKey];
  // Realistic moves only, unless "Show stars" is on: untouchable players (franchise players, top-20 players,
  // recent top-5 picks, a contender's top two) are left out of the lists and the scatter
  const hidden = d.candidates.filter((c) => c[13] === "untouchable");
  const pool = d.candidates.filter((c) => (stars || c[13] !== "untouchable")
    && c[4] >= sal.min && c[4] < sal.max && (c[5] === null || (c[5] >= age.min && c[5] <= age.max)));
  const rows = (list === "free" ? pool.filter((c) => c[14])
    : list === "bargains" ? pool.filter((c) => c[4] < BARGAIN_MAX && c[13] !== "untouchable" && (c[14] || c[13] === "gettable"))
    : pool.filter((c) => !c[14])).slice(0, 12);
  const top = rows[0];
  const who = (c: Candidate) => (c[14] ? `Free agent ${c[1]}` : c[1]);
  // A free agent's price is a guide: what he was paid last season
  const price = (c: Candidate) => (c[14] ? `about ${money(c[4])}` : money(c[4]));
  const fills = (c: Candidate) => d.holes.filter((k) => (c[12][k] ?? 0) >= 70);
  const targetsTitle = !top
    ? "No players match these filters."
    : fills(top).length === d.holes.length && d.holes.length > 1
      ? `${who(top)} fills all ${WORDS[d.holes.length]} of your holes for ${price(top)}.`
      : fills(top).length
        ? `${who(top)} fills your ${lower(fills(top)[0])} hole for ${price(top)}, with a fit of ${top[3]}.`
        : `${who(top)} is the best fit, ${top[3]} out of 100, for ${price(top)}.`;

  // ----- Scatter: fit against salary
  const ourBest = [...d.roster].filter((r) => r.fit !== null).sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0))[0];
  const cheapBetter = pool.filter((c) => c[4] < 15e6 && c[3] > (ourBest?.fit ?? 100));
  const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
  const median = (xs: number[]) => (xs.length ? sorted(xs)[Math.floor(xs.length / 2)] : 0);
  const scatterTitle = cheapBetter.length
    ? `${cheapBetter.length} player${cheapBetter.length === 1 ? "" : "s"} fit your holes better than anyone you have, for under $15M.`
    : `Nobody under $15M fits your holes better than ${ourBest?.name ?? "your roster"}.`;

  // ----- Top target next to our best fit
  // Compare like with like: the target against the player he would compete with for minutes. Positions sit on a
  // guard-to-center scale (G 1, G-F 1.33, F-G 1.67, F 2, F-C 2.33, C-F 2.67, C 3). Among our rated players within
  // half a step of the target, take the closest group (within a third of a step of the best match), then the
  // one who plays the most. Nobody that close: there is no like-for-like player, and the card says so.
  const SPOT: Record<string, number> = { G: 1, F: 2, C: 3 };
  const spot = (pos: string | null | undefined) => {
    const [a, b] = (pos ?? "").split("-").map((x) => SPOT[x]);
    return a === undefined ? null : b === undefined ? a : (2 * a + b) / 3;
  };
  const rated = d.roster.filter((r) => r.pcts && spot(r.position) !== null);
  const targetSpot = top ? spot(top[17]) : null;
  const near = targetSpot === null ? [] : rated
    .map((r) => ({ r, gap: Math.abs(spot(r.position)! - targetSpot) }))
    .filter((x) => x.gap <= 0.5);
  const bestGap = near.length ? Math.min(...near.map((x) => x.gap)) : 0;
  const rival = near.filter((x) => x.gap <= bestGap + 0.34).sort((a, b) => b.r.mpg - a.r.mpg)[0]?.r ?? null;
  const pairRows = top && rival
    ? [...holes, ...strengths].map((n) => ({ need: n.need, t: top[12][n.need] ?? 0, o: rival.pcts?.[n.need] ?? 0, hole: d.holes.includes(n.need) }))
    : [];
  const gain = pairRows.filter((r) => r.hole).sort((a, b) => b.t - b.o - (a.t - a.o))[0];
  const loss = pairRows.filter((r) => !r.hole).sort((a, b) => a.t - a.o - (b.t - b.o))[0];
  const tLast = top ? lastName(top[1]) : "", oLast = rival ? lastName(rival.name) : "";
  const pairTitle = !top || !rival
    ? ""
    : gain && gain.t - gain.o > 0
      ? `${tLast} is ${gain.t - gain.o} percentile points better than ${oLast} in ${lower(gain.need)}` +
        (loss && loss.o - loss.t >= 10 ? `, but gives up ${loss.o - loss.t} in ${lower(loss.need)}.` : `, and holds up in your strengths.`)
      : `${oLast} already covers your holes better than ${tLast}.`;

  return (
    <div style={{ ...teamTheme(mine.abbr), ...(top ? { "--opp": opponentColor(mine.abbr, top[2]) } : {}) } as React.CSSProperties}>
      <Hero
        eyebrow={`Roster Needs · ${d.seasonLabel} · Ranked against all 30 teams`}
        title={`Where the ${mine.name} are short`}
        watermark={{ src: logoUrl(mine.id), alt: `${mine.name} logo` }}
        controls={<>
          <ParamSelect name="season" label="Season" value={String(d.season)} options={seasonOptions(d.seasons)} />
          <Toggle name="side" value={side} options={SIDES} sp={sp} />
        </>}
        side={
          <div className="flex flex-[0_1_380px] flex-col gap-1 border-t-[3px] border-current pb-16 pt-4">
            <span className="label">{realHoles.length ? "Biggest hole" : "Weakest spot"}</span>
            <span className="display text-[64px]">{ordinal(worst.rank)}</span>
            <span className="text-[15px]">in {lower(worst.need)}: {valueLine(worst)}</span>
          </div>
        }
      />

      <Wrap>
        {/* 2. Team needs */}
        <Section className="flex flex-col gap-6">
          <Heading title={needsTitle}
            caption={`League percentile in each need, 0 is worst and 100 is best. Holes are up to three ${side === "both" ? "" : `${side} `}needs where the ${mine.name} rank 16th or worse.`} />
          <Legend items={[
            { label: "Hole", color: "var(--accent)" },
            { label: "Not a hole", color: "var(--panel-dot)" },
            { label: "League middle", color: "var(--panel-muted)", kind: "dashed" },
          ]} />
          <HorizontalBarChart
            name="Percentile" icon="medal" domain={[0, 100]} refLine={50} categoryWidth={250} rowHeight={42} bigValues valueWidth={92}
            data={NEED_ORDER.filter((k) => byNeed.has(k)).map((k) => {
              const n = byNeed.get(k)!;
              return {
                key: k, label: NEEDS[k].label, value: Math.max(2, n.pctile), valueText: ordinal(n.rank),
                fill: d.holes.includes(k) ? "var(--accent)" : "var(--panel-dot)",
                tips: [
                  { label: mine.abbr, value: `${NEEDS[k].fmt(n.value)} ${NEEDS[k].unit}`, icon: "trophy" as const },
                  { label: "League average", value: NEEDS[k].fmt(n.leagueAvg), icon: "scale" as const },
                  { label: "Best team", value: NEEDS[k].fmt(n.best), icon: "medal" as const },
                ],
              };
            })}
          />
          <p className="text-[14px] text-muted">Hover a bar for the team&apos;s value, the league average and the best team. The rank sits at the end.</p>
        </Section>

        {/* 3. Trends */}
        <Section className="flex flex-col gap-6">
          <Heading title={trendTitle}
            caption="Each hole as a rolling 10-game average against the league average. A recent slide may be an injury, not a reason to trade." />
          <Legend items={[
            { label: `${mine.abbr}, last 10 games`, color: "var(--accent)", kind: "line" },
            { label: "League average", color: "var(--panel-muted)", kind: "dashed" },
          ]} />
          <div className="grid items-stretch gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
            {trends.map(({ h, series, last, change }) => (
              <div key={h.need} className="flex flex-col border border-line" style={{ borderRadius: 12, padding: 20 }}>
                <span className="label text-muted">{NEEDS[h.need].label} · {ordinal(h.rank)}</span>
                {last !== null && series.length > 1 ? (
                  <>
                    <span className="display mt-3 text-[40px]" style={{ color: "var(--accent)" }}>{NEEDS[h.need].fmt(last)}</span>
                    <span className="font-mono text-[12px]" style={{ color: change < -0.04 ? "var(--warn)" : "var(--muted)" }}>
                      Last 10 games · season {NEEDS[h.need].fmt(h.value)}{change < -0.04 ? " · slipping" : change > 0.04 ? " · improving" : " · steady"}
                    </span>
                    <div style={{ marginTop: "auto", paddingTop: 12 }}>
                      <NeedTrendChart data={series} league={h.leagueAvg} label={NEEDS[h.need].label} format={trendFormat(h.need)} />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="display mt-3 text-[40px]" style={{ color: "var(--accent)" }}>{NEEDS[h.need].fmt(h.value)}</span>
                    <span className="text-[14px] text-muted" style={{ marginTop: 8 }}>{NEEDS[h.need].unit} for the season. League average {NEEDS[h.need].fmt(h.leagueAvg)}. There is no game-by-game data for this one.</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Roster heatmap */}
        <Section className="flex flex-col gap-6">
          <Heading title={heatTitle}
            caption={`${d.rosterSeason ? `Today's roster, rated on ${d.seasonLabel} numbers wherever each player was` : "Each rotation player"}: league percentile in each need, sorted by minutes. Holes come first. A column with no warm cells is a skill the roster doesn't have.`} />
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 960, borderCollapse: "separate", borderSpacing: 3, tableLayout: "fixed" }}>
              {/* Fixed widths: the name column, then every need column the same width */}
              <colgroup>
                <col style={{ width: 230 }} />
                {cols.map((k, i) => <col key={k ?? `gap${i}`} style={k === null ? { width: 12 } : undefined} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="label text-left font-medium text-muted" style={{ padding: "0 4px 4px", verticalAlign: "bottom" }}>Player · minutes a game</th>
                  {cols.map((k, i) => k === null
                    ? <th key={`gap${i}`} style={{ width: 12 }} />
                    : <th key={k} className="label text-center font-medium" style={{ padding: "0 4px 4px", verticalAlign: "bottom", color: d.holes.includes(k) ? "var(--accent)" : "var(--muted)", fontSize: 10 }}>
                        {d.holes.includes(k) ? "▲ " : ""}{NEEDS[k].short}
                      </th>)}
                </tr>
              </thead>
              <tbody>
                {d.roster.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap" style={{ paddingRight: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <Link href={`/player?player=${r.id}&season=${d.season}`} className="display block text-[20px] font-extrabold tracking-[0.02em] hover:underline">{r.name}</Link>
                      <span className="font-mono text-[11px] text-muted">{r.mpg} min</span>
                    </td>
                    {cols.map((k, i) => {
                      if (k === null) return <td key={`gap${i}`} />;
                      const p = r.pcts?.[k];
                      return (
                        <td key={k} className="text-center font-mono text-[13px]"
                          style={{ height: 40, borderRadius: 4, background: p == null ? "var(--soft)" : heatColor(p / 100), color: p != null && (p > 82 || p < 18) ? "#fff" : "var(--ink)" }}>
                          {p ?? "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HeatLegend low="Weaker" high="Stronger" />
          <p className="text-[14px] text-muted">A dash means fewer than 500 minutes this season, too few to rank.</p>
        </Section>

        {/* 5. Targets */}
        <Section className="flex flex-col gap-6">
          <Heading title={targetsTitle}
            caption={`${list === "free" ? "Players who played last season and are on no roster today" : list === "bargains" ? `Gettable players and free agents paid under ${money(BARGAIN_MAX)}` : "Players on other teams"}, ranked by fit: their percentile in your holes, weighted by how far down the league you rank in each.`} />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Toggle name="list" value={list} options={d.rosterSeason ? LISTS : LISTS.filter(([v]) => v !== "free")} sp={sp} tone="page" />
            <div className="flex flex-wrap items-center gap-2">
              {list === "targets" ? <Toggle name="stars" value={stars ? "1" : "0"} options={STARS} sp={sp} tone="page" /> : null}
              <ParamSelect name="salary" label="Salary" value={salaryKey} options={Object.entries(SALARY).map(([value, o]) => ({ value, label: o.label }))} />
              <ParamSelect name="age" label="Age" value={ageKey} options={Object.entries(AGES).map(([value, o]) => ({ value, label: o.label }))} />
            </div>
          </div>
          <Legend items={[
            { label: "Fit, 0 to 100", color: "var(--accent)" },
            { label: "Percentile in one of your holes (70+ is highlighted)", color: "color-mix(in srgb, var(--accent) 30%, white)" },
            { label: "Seller: team is in the bottom 10", color: "var(--warn)" },
            { label: "Hard to get: second-best player, or paid $35M+ (hover for why)", color: "var(--ink)" },
            ...(d.rosterSeason ? [{ label: `Expiring: contract ends after ${seasonName(d.rosterSeason)}`, color: "var(--accent)" }] : []),
          ]} />
          {!stars && hidden.length && list === "targets" ? (
            <p className="text-[14px] text-muted">
              Left out: {hidden.length} untouchable players, such as {listNames(hidden.slice(0, 3).map((c) => `${c[1]} (${c[16]})`))}. Teams
              don&apos;t trade their best player, a top-20 player, a recent top-5 pick or a contender&apos;s top two. Use Show stars to see them anyway.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1060 }}>
              <div className="label grid gap-3 border-b-[3px] border-ink pb-2 text-muted" style={TARGET_COLS}>
                <span>#</span><span>Player</span><span>Fit</span><span>Your holes</span>
                <span className="text-right">{list === "free" ? "Last salary" : "Salary"}</span><span className="text-right">Contract</span>
                <span className="text-right">$ per WS</span><span className="text-right">VORP</span><span className="text-right">Age</span>
              </div>
              {rows.map((c, i) => (
                <div key={c[0]} className="row-hover grid items-center gap-3 border-b border-line py-3" style={TARGET_COLS}>
                  <span className="font-mono text-[14px] text-muted">{i + 1}</span>
                  <div className="flex min-w-0 flex-col">
                    <span className="display truncate text-[24px] font-extrabold tracking-[0.02em]">{c[1]}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-muted">
                      {c[14] ? `Free agent · last ${c[2]}` : c[2]}{c[17] ? ` · ${c[17]}` : ""} · {c[11]} games
                      {c[9] && !c[14] ? <Tag tone="warn">Seller</Tag> : null}
                      {c[13] === "hard" ? <Tag tone="ink" title={c[16] ?? undefined}>Hard to get</Tag> : null}
                      {c[13] === "untouchable" ? <Tag tone="ink" title={c[16] ?? undefined}>Untouchable</Tag> : null}
                      {d.rosterSeason && c[15] === d.rosterSeason ? <Tag tone="accent">Expiring</Tag> : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 rounded-[4px] bg-soft" style={{ height: 18 }}>
                      <div className="absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${c[3]}%`, background: "var(--accent)", opacity: i === 0 ? 1 : 0.75 }} />
                    </div>
                    <span className="display text-right text-[28px]" style={{ width: 36 }}>{c[3]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">{d.holes.map((k) => <Chip key={k} need={k} pct={c[12][k]} />)}</div>
                  <span className="text-right font-mono text-[14px]">{money(c[4])}</span>
                  <span className="text-right font-mono text-[13px] text-muted">{c[14] ? "Unsigned" : c[15] ? `to ${seasonName(c[15])}` : "-"}</span>
                  <span className="text-right font-mono text-[14px]">{fmtPerWs(c[8])}</span>
                  <span className="text-right font-mono text-[14px]">{c[7] === null ? "-" : c[7].toFixed(1)}</span>
                  <span className="text-right font-mono text-[14px]">{c[5] === null ? "-" : Math.floor(c[5])}</span>
                </div>
              ))}
              {!rows.length ? <p className="py-6 text-[15px] text-muted">No players match these filters. Try a wider salary or age range.</p> : null}
            </div>
          </div>
        </Section>

        {/* 6 + 7 */}
        <Section className="grid items-stretch gap-6 lg:grid-cols-2">
          <ChartCard className="h-full" title={scatterTitle}
            description={`Fit against salary for every ${stars ? "" : "realistic "}target and free agent in the filters above. Top left is the most fit for the money.${ourBest ? ` Best fit already on the roster: ${ourBest.name} (${ourBest.fit}).` : ""}`}
            legend={[
              { label: "Top 6 targets", color: "var(--accent)", kind: "dot" },
              { label: "Other players", color: "var(--panel-dot)", kind: "dot" },
              { label: "Medians", color: "var(--panel-muted)", kind: "dashed" },
            ]}>
            <FitScatterChart
              points={pool.map((c) => ({ id: c[0], name: c[1], team: c[2], salaryM: c[4] / 1e6, fit: c[3] }))}
              highlight={rows.slice(0, 6).map((c) => c[0])}
              medianSalary={median(pool.map((c) => c[4] / 1e6))}
              medianFit={median(pool.map((c) => c[3]))}
            />
          </ChartCard>
          {top && rival ? (
            <ChartCard className="h-full" title={pairTitle}
              description={`Your top target next to the ${mine.abbr} player at his position who plays the most, the one he would compete with for minutes. League percentiles: holes first, then the strengths you'd want to keep.`}
              legend={[
                { label: `${rival.name} (${mine.abbr}${rival.position ? `, ${rival.position}` : ""})`, color: "var(--accent)" },
                { label: `${top[1]} (${top[2]}${top[17] ? `, ${top[17]}` : ""})`, color: "var(--opp)" },
              ]}
              note="Percentiles among players with 500+ minutes this season.">
              <PairedHorizontalBarChart
                a={rival.name} b={top[1]} rowHeight={58}
                data={pairRows.map((r) => ({
                  key: r.need, label: NEEDS[r.need].short.toUpperCase(), a: r.o, b: r.t, aText: String(r.o), bText: String(r.t), scale: 100,
                }))}
              />
            </ChartCard>
          ) : top ? (
            <ChartCard className="h-full" title={`No ${mine.abbr} player plays ${lastName(top[1])}'s position${top[17] ? ` (${top[17]})` : ""}.`}
              description="The comparison needs a rotation player at the same position who played enough last season to rate. A target here would fill an empty spot, not replace anyone.">
              <div />
            </ChartCard>
          ) : <div />}
        </Section>

        <p className="mt-16 border-t-[3px] border-ink pt-5 text-[14px] leading-[1.6] text-muted">
          <b className="font-medium text-ink">How fit works.</b> Each player&apos;s league percentile in your holes, weighted by how far down
          the league you rank in each, from 0 to 100. Players with 500+ minutes and a known salary. Some needs blend two skills (threes made and
          accuracy; blocks and opponent FG% at the rim). No player stat tracks transition defense, so it uses his on/off defensive rating.
          This shows who covers your weak spots, not how many wins a trade adds.
        </p>
      </Wrap>
    </div>
  );
}
