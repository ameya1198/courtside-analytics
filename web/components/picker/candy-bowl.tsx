"use client";

import type MatterNS from "matter-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { selectTeam } from "@/app/actions";
import { cn } from "@/lib/utils";

export type BowlTeam = { abbr: string; full: string; nick: string; color: string; logo: string; record: string | null };

type Geo = ReturnType<typeof geometry>;
type Sim = {
  M: typeof MatterNS;
  engine: MatterNS.Engine;
  bodies: Map<string, MatterNS.Body>;
  inBowl: Set<string>;
  geo: Geo;
};

/** Bowl and candy sizes for a given stage width. The bowl is the lower half of an ellipse whose rim sits near the top. */
function geometry(W: number) {
  const H = Math.round(Math.max(300, Math.min(500, W * 0.48)));
  const R = Math.round(Math.max(20, Math.min(36, W / 28)));
  const a = Math.min(W * 0.46, 420);
  return { W, H, R, cx: W / 2, rimY: H * 0.14, a, b: H * 0.8, ry: a * 0.1 };
}

// Candies are round, so only the logo shows rotation. A gentle tilt keeps every logo the right way up.
const tilt = (angle: number) => 0.5 * Math.sin(angle);

const BTN =
  "inline-flex h-[50px] cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap px-6 text-[16px] font-semibold transition-[background-color,box-shadow,transform] duration-200 active:translate-y-px";

/**
 * The team picker: all 30 teams as candies in a glass bowl. Candies can be grabbed and tossed or shaken;
 * a click lifts one out and asks for confirmation, so playing with the bowl never picks a team by accident.
 */
export function CandyBowl({ teams, current }: { teams: BowlTeam[]; current: string | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLButtonElement>());
  const sim = useRef<Sim | null>(null);
  const heldRef = useRef<string | null>(null);
  const drag = useRef<{ abbr: string; start: { x: number; y: number }; c: MatterNS.Constraint | null } | null>(null);

  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [held, setHeld] = useState<BowlTeam | null>(null);
  const [query, setQuery] = useState("");
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const geo = width ? geometry(width) : null;

  // Rebuild the bowl only when the width changes enough to matter
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth((w) => (Math.abs(el.clientWidth - w) > 40 ? el.clientWidth : w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let raf = 0;
    const g = geometry(width);
    import("matter-js").then((mod) => {
      if (cancelled) return;
      const M = ((mod as { default?: typeof MatterNS }).default ?? mod) as typeof MatterNS;
      const { Engine, Bodies, Body, Composite } = M;
      const engine = Engine.create({ enableSleeping: true });
      engine.gravity.y = 1.1;

      // The wall: short static segments along the bowl's curve, pushed outward so their inner edge is the curve itself
      const walls: MatterNS.Body[] = [];
      const segs = 28;
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * Math.PI, t1 = ((i + 1) / segs) * Math.PI;
        const x0 = g.cx + g.a * Math.cos(t0), y0 = g.rimY + g.b * Math.sin(t0);
        const x1 = g.cx + g.a * Math.cos(t1), y1 = g.rimY + g.b * Math.sin(t1);
        const nx = Math.cos((t0 + t1) / 2), ny = Math.sin((t0 + t1) / 2);
        walls.push(Bodies.rectangle((x0 + x1) / 2 + nx * 10, (y0 + y1) / 2 + ny * 10, Math.hypot(x1 - x0, y1 - y0) + 6, 20,
          { isStatic: true, angle: Math.atan2(y1 - y0, x1 - x0), friction: 0.4 }));
      }
      // An invisible lip above the rim, a floor and side walls, so a shake or a toss can't lose a candy off screen
      walls.push(
        Bodies.rectangle(g.cx - g.a - 10, g.rimY - g.R * 1.5, 20, g.R * 3, { isStatic: true }),
        Bodies.rectangle(g.cx + g.a + 10, g.rimY - g.R * 1.5, 20, g.R * 3, { isStatic: true }),
        Bodies.rectangle(g.W / 2, g.H + 30, g.W * 2, 60, { isStatic: true }),
        Bodies.rectangle(-30, g.H / 2, 60, g.H * 4, { isStatic: true }),
        Bodies.rectangle(g.W + 30, g.H / 2, 60, g.H * 4, { isStatic: true }),
      );
      Composite.add(engine.world, walls);

      // Fill the bowl in a random order and let it settle before the first frame, so it opens already full
      const bodies = new Map<string, MatterNS.Body>();
      const inBowl = new Set<string>();
      for (const t of [...teams].sort(() => Math.random() - 0.5)) {
        const body = Bodies.circle(g.cx + (Math.random() * 2 - 1) * g.a * 0.4, g.rimY - g.R * 2 - Math.random() * g.H * 0.4, g.R,
          { restitution: 0.18, friction: 0.08, frictionAir: 0.012, density: 0.002 });
        Body.setAngle(body, Math.random() * Math.PI * 2);
        bodies.set(t.abbr, body);
        if (t.abbr === heldRef.current) continue; // still in the visitor's hand from before a resize
        Composite.add(engine.world, body);
        inBowl.add(t.abbr);
      }
      for (let i = 0; i < 500; i++) Engine.update(engine, 1000 / 60);
      sim.current = { M, engine, bodies, inBowl, geo: g };

      const loop = () => {
        Engine.update(engine, 1000 / 60);
        for (const abbr of inBowl) {
          const b = bodies.get(abbr)!, el = els.current.get(abbr);
          if (el) el.style.transform = `translate(${b.position.x}px, ${b.position.y}px) rotate(${tilt(b.angle)}rad)`;
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
      setReady(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (sim.current) sim.current.M.Engine.clear(sim.current.engine);
      sim.current = null;
    };
  }, [width, teams]);

  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams]);

  // Type-to-find: an exact code or nickname wins, otherwise any team whose name contains the text
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const exact = teams.filter((t) => t.abbr.toLowerCase() === q || t.nick.toLowerCase() === q);
    return new Set((exact.length ? exact : teams.filter((t) => t.full.toLowerCase().includes(q))).map((t) => t.abbr));
  }, [query, teams]);

  function pick(abbr: string) {
    const s = sim.current;
    if (s?.inBowl.has(abbr)) {
      s.M.Composite.remove(s.engine.world, s.bodies.get(abbr)!);
      s.inBowl.delete(abbr);
    }
    heldRef.current = abbr;
    setTip(null);
    setHeld(byAbbr.get(abbr) ?? null);
  }

  function putBack() {
    const abbr = heldRef.current;
    heldRef.current = null;
    setHeld(null);
    const s = sim.current;
    if (!abbr || !s || s.inBowl.has(abbr)) return;
    const { Body, Composite, Sleeping } = s.M;
    const body = s.bodies.get(abbr)!;
    Body.setPosition(body, { x: s.geo.cx + (Math.random() * 2 - 1) * s.geo.a * 0.4, y: s.geo.rimY - s.geo.R * 3 });
    Body.setVelocity(body, { x: 0, y: 0 });
    Composite.add(s.engine.world, body);
    Sleeping.set(body, false); // it was usually asleep when picked out, which would leave it hanging in mid-air
    s.inBowl.add(abbr);
    setTimeout(() => els.current.get(abbr)?.focus({ preventScroll: true })); // after React shows it again
  }

  function shake() {
    const s = sim.current;
    if (!s) return;
    for (const abbr of s.inBowl) {
      const b = s.bodies.get(abbr)!;
      s.M.Sleeping.set(b, false);
      s.M.Body.setVelocity(b, { x: (Math.random() * 2 - 1) * 4, y: -6 - Math.random() * 6 });
      s.M.Body.setAngularVelocity(b, (Math.random() * 2 - 1) * 0.3);
    }
  }

  // A press that moves more than a few pixels drags the candy on a spring; a press that doesn't is a click and picks it
  const local = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function onMove(e: React.PointerEvent) {
    const d = drag.current, s = sim.current;
    if (!d || !s) return;
    const p = local(e);
    if (!d.c && Math.hypot(p.x - d.start.x, p.y - d.start.y) > 6) {
      setTip(null);
      const body = s.bodies.get(d.abbr)!;
      s.M.Sleeping.set(body, false);
      d.c = s.M.Constraint.create({ pointA: p, bodyB: body, pointB: { x: 0, y: 0 }, stiffness: 0.12, damping: 0.1, length: 0 });
      s.M.Composite.add(s.engine.world, d.c);
    }
    if (d.c) d.c.pointA = p;
  }
  function onUp() {
    const d = drag.current, s = sim.current;
    drag.current = null;
    if (!d) return;
    if (d.c && s) s.M.Composite.remove(s.engine.world, d.c);
    else pick(d.abbr);
  }
  function showTip(t: BowlTeam) {
    const b = sim.current?.bodies.get(t.abbr);
    if (b && !drag.current) setTip({ text: t.full, x: b.position.x, y: b.position.y - (geo?.R ?? 30) });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6 pt-6">
        <div>
          <h1 className="display text-[clamp(56px,8vw,112px)]">Grab one.</h1>
          <p className="mt-3.5 max-w-[40ch] text-[18px] leading-[1.5] text-muted">
            All 30 teams are in the bowl. Pick yours and every page opens from its side.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <label htmlFor="find-team" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">Find</label>
            <input
              id="find-team"
              type="search"
              autoComplete="off"
              placeholder="Nuggets, BOS..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits?.size === 1) pick([...hits][0]);
              }}
              className="h-[46px] w-full border border-line bg-paper pl-[54px] pr-3.5 text-[15px] placeholder:text-[#8a909b] focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-[260px]"
            />
          </div>
          <button type="button" onClick={shake} className={cn(BTN, "h-[46px] shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink)]")}>
            Shake the bowl
          </button>
        </div>
      </div>

      <div
        ref={stage}
        role="group"
        aria-label="Bowl of 30 team candies. Each candy is a button."
        className="relative mt-12 select-none"
        style={{ height: geo ? geo.H : "clamp(300px, 48vw, 500px)" }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {geo ? <BowlBack g={geo} /> : null}
        {geo
          ? teams.map((t) => (
              <button
                key={t.abbr}
                ref={(el) => {
                  if (el) els.current.set(t.abbr, el);
                  else els.current.delete(t.abbr);
                }}
                type="button"
                aria-label={t.record ? `${t.full}, ${t.record}` : t.full}
                data-find={hits ? (hits.has(t.abbr) ? "hit" : "dim") : undefined}
                className={cn("candy", (!ready || held?.abbr === t.abbr) && "invisible")}
                style={{ "--c": t.color, "--d": `${geo.R * 2}px` } as React.CSSProperties}
                onPointerDown={(e) => {
                  drag.current = { abbr: t.abbr, start: local(e), c: null };
                  stage.current?.setPointerCapture(e.pointerId);
                }}
                onClick={(e) => {
                  if (e.detail === 0) pick(t.abbr); // keyboard; pointer clicks are handled on pointer up
                }}
                onMouseEnter={() => showTip(t)}
                onMouseLeave={() => setTip(null)}
                onFocus={() => showTip(t)}
                onBlur={() => setTip(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.logo} alt="" draggable={false} />
              </button>
            ))
          : null}
        {geo ? <BowlFront g={geo} /> : null}
        {tip ? (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap bg-ink px-2.5 py-1.5 text-[13px] font-medium text-paper"
            style={{ left: tip.x, top: tip.y - 10 }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>

      {held ? <Held team={held} isCurrent={held.abbr === current} onBack={putBack} /> : null}
    </>
  );
}

function BowlBack({ g }: { g: Geo }) {
  const body = `M ${g.cx - g.a} ${g.rimY} A ${g.a} ${g.b} 0 0 0 ${g.cx + g.a} ${g.rimY}`;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${g.W} ${g.H}`} aria-hidden>
      <defs>
        <linearGradient id="bowl-glass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b0d12" stopOpacity="0.02" />
          <stop offset="1" stopColor="#0b0d12" stopOpacity="0.09" />
        </linearGradient>
        <radialGradient id="bowl-floor">
          <stop offset="0" stopColor="#0b0d12" stopOpacity="0.16" />
          <stop offset="1" stopColor="#0b0d12" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={g.cx} cy={g.rimY + g.b + 6} rx={g.a * 0.8} ry={g.b * 0.12} fill="url(#bowl-floor)" />
      <path d={`${body} Z`} fill="url(#bowl-glass)" />
      <path d={`M ${g.cx - g.a} ${g.rimY} A ${g.a} ${g.ry} 0 0 1 ${g.cx + g.a} ${g.rimY}`} fill="none" stroke="#0b0d12" strokeOpacity="0.14" strokeWidth="2" />
    </svg>
  );
}

function BowlFront({ g }: { g: Geo }) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox={`0 0 ${g.W} ${g.H}`} aria-hidden>
      <path d={`M ${g.cx - g.a} ${g.rimY} A ${g.a} ${g.b} 0 0 0 ${g.cx + g.a} ${g.rimY}`} fill="none" stroke="#0b0d12" strokeOpacity="0.22" strokeWidth="2.5" />
      <path d={`M ${g.cx - g.a} ${g.rimY} A ${g.a} ${g.ry} 0 0 0 ${g.cx + g.a} ${g.rimY}`} fill="none" stroke="#0b0d12" strokeOpacity="0.28" strokeWidth="2.5" />
      <path
        d={`M ${g.cx - g.a * 0.78} ${g.rimY + g.b * 0.3} A ${g.a * 0.86} ${g.b * 0.86} 0 0 0 ${g.cx - g.a * 0.3} ${g.rimY + g.b * 0.86}`}
        fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round"
      />
    </svg>
  );
}

function Confirm({ nick }: { nick: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} autoFocus className={cn(BTN, "bg-ink text-paper hover:bg-[var(--c)] disabled:cursor-wait disabled:opacity-80")}>
      {pending ? `Opening the ${nick} report...` : `Open the ${nick} report`}
    </button>
  );
}

/** The picked candy held up big, with the confirm step. Escape, a click outside or "Put it back" returns it to the bowl. */
function Held({ team, isCurrent, onBack }: { team: BowlTeam; isCurrent: boolean; onBack: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="held-title"
      className="fixed inset-0 z-50 grid place-items-center bg-paper/95 backdrop-blur-lg"
      style={{ "--c": team.color } as React.CSSProperties}
      onClick={(e) => e.target === e.currentTarget && onBack()}
    >
      <div className="flex max-w-[440px] flex-col items-center gap-[18px] px-8 py-10 text-center">
        <span className="candy candy-held" style={{ "--d": "168px" } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={team.logo} alt="" />
        </span>
        <h2 id="held-title" className="display text-[clamp(40px,6vw,64px)]">{team.full}</h2>
        <p className="text-[16px] text-muted">
          {isCurrent ? "This is your team now. " : team.record ? `${team.record} this season. ` : ""}Every page opens from this team&apos;s side.
        </p>
        <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
          <form action={selectTeam}>
            <input type="hidden" name="abbr" value={team.abbr} />
            <Confirm nick={team.nick} />
          </form>
          <button type="button" onClick={onBack} className={cn(BTN, "shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink)]")}>
            Put it back
          </button>
        </div>
      </div>
    </div>
  );
}
