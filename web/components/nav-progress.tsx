"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { endNav, startNav, useNavPending } from "@/lib/nav-progress";

// What each page loads, for the caption under the bouncing ball
const PAGES: Record<string, { title: string; detail: string }> = {
  "/league": { title: "League Pulse", detail: "Ranking all 30 teams" },
  "/team": { title: "Team Report", detail: "Pulling the team's games" },
  "/defense": { title: "Defense", detail: "Pulling shots and on/off splits" },
  "/player": { title: "Player Profile", detail: "Loading the player's games" },
  "/value": {
    title: "Player Value",
    detail: "Crunching dollars per Win Share",
  },
  "/needs": { title: "Roster Needs", detail: "Ranking your holes and every target" },
  "/rest": { title: "Rest and Schedule", detail: "Checking the schedule" },
  "/matchup": { title: "Matchup Scout", detail: "Scouting both teams" },
  "/tonight": { title: "Tonight", detail: "Getting tonight's games" },
  "/pick": { title: "Teams", detail: "Loading all 30 teams" },
  "/": { title: "Courtside", detail: "Heading back to the start" },
};

// The full-page loader only shows when a page takes longer than this. Quick loads just get the bar.
const OVERLAY_DELAY_MS = 450;

// Sizes are also set on the elements, so the ball stays small even before the styles arrive
function Ball({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden style={{ display: "block" }}>
      <circle cx="24" cy="24" r="22" fill="#e8742a" />
      <g fill="none" stroke="#0b0d12" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="24" cy="24" r="22" />
        <line x1="24" y1="2" x2="24" y2="46" />
        <line x1="2" y1="24" x2="46" y2="24" />
        <path d="M9 8.5 C17 16, 17 32, 9 39.5" />
        <path d="M39 8.5 C31 16, 31 32, 39 39.5" />
      </g>
    </svg>
  );
}

// The loader's styles travel with it. React puts this in <head> once, so a stale cached stylesheet can't break it.
// --nav-accent is the chosen team's colour, set on <body> in the layout.
const CSS = `
.nav-progress {
  position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 40; pointer-events: none;
}
.nav-progress-fill {
  position: relative; height: 100%; width: 0; border-radius: 0 2px 2px 0;
  background: var(--nav-accent, var(--accent));
  animation: nav-progress-grow 3.2s cubic-bezier(.1,.6,.3,1) forwards;
}
.nav-progress[data-state="done"] .nav-progress-fill {
  width: 100%; animation: nav-progress-done 350ms ease-out forwards;
}
.nav-progress-ball {
  position: absolute; right: -9px; bottom: 3px; width: 18px; height: 18px;
  animation: nav-progress-dribble 0.36s cubic-bezier(.45,0,.55,1) infinite alternate;
}
.nav-progress-ball svg { display: block; width: 100%; height: 100%; animation: nav-spin 1.2s linear infinite; }
@keyframes nav-progress-grow { from { width: 0; } to { width: 85%; } }
@keyframes nav-progress-done { from { opacity: 1; } to { opacity: 0; } }
@keyframes nav-progress-dribble {
  0% { transform: translateY(-22px); animation-timing-function: cubic-bezier(.55,0,1,.45); }
  100% { transform: translateY(0) scale(1.12, .85); }
}
@keyframes nav-spin { to { transform: rotate(360deg); } }

.nav-overlay {
  position: absolute; inset: 0; z-index: 30; background: var(--paper);
  animation: nav-fade 150ms ease-out;
}
.nav-skeleton { max-width: 1280px; margin: 0 auto; padding: 32px 16px; display: flex; flex-direction: column; gap: 14px; }
@media (min-width: 768px) { .nav-skeleton { padding: 32px 48px; } }
.nav-sk { height: 14px; border-radius: 4px; background: var(--soft); animation: nav-pulse 1.6s ease-in-out infinite; }
.nav-sk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 18px; }
.nav-sk-card { height: 260px; }
.nav-hero {
  height: 320px; margin-bottom: 18px; border-radius: 4px; background: var(--soft);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center;
}
.nav-bounce-court { position: relative; width: 120px; height: 150px; margin-bottom: 6px; }
.nav-bounce-ball {
  position: absolute; left: 36px; top: 0; width: 48px; height: 48px; transform-origin: 50% 100%;
  animation: nav-drop 0.45s cubic-bezier(.45,0,.55,1) infinite alternate;
}
.nav-bounce-ball svg { display: block; width: 100%; height: 100%; animation: nav-spin 1.8s linear infinite; }
.nav-bounce-shadow {
  position: absolute; left: 30px; bottom: 0; width: 60px; height: 8px; border-radius: 50%; background: var(--ink);
  animation: nav-shadow 0.45s cubic-bezier(.45,0,.55,1) infinite alternate;
}
.nav-bounce-floor {
  position: absolute; left: 0; right: 0; bottom: 3px; height: 3px; border-radius: 2px;
  background: var(--nav-accent, var(--accent));
}
.nav-dots { display: inline-block; width: 0; text-align: left; }
.nav-dots::after { content: ""; animation: nav-dots 1.4s steps(4) infinite; }
@keyframes nav-drop {
  0% { transform: translateY(0) scale(1, 1); animation-timing-function: cubic-bezier(.55,0,1,.45); }
  88% { transform: translateY(98px) scale(1, 1); }
  100% { transform: translateY(98px) scale(1.14, .82); }
}
@keyframes nav-shadow { from { transform: scaleX(.45); opacity: .08; } to { transform: scaleX(1); opacity: .22; } }
@keyframes nav-dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
@keyframes nav-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes nav-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }

@media (prefers-reduced-motion: reduce) {
  .nav-progress-ball, .nav-progress-ball svg, .nav-bounce-ball, .nav-bounce-ball svg, .nav-bounce-shadow, .nav-sk { animation-duration: 2.4s; }
}
`;

function LoaderStyles() {
  return (
    <style href="courtside-nav-progress" precedence="default">
      {CSS}
    </style>
  );
}

/** Starts the loader on internal link clicks and ends it when the new route renders. Mounted once in the layout. */
export function NavWatcher() {
  const path = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => endNav(), [path, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      startNav(url.pathname);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

/** Thin bar along the bottom of the tabs with a ball dribbling at its front edge. */
export function NavProgressBar() {
  const pending = useNavPending();
  const [finishing, setFinishing] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  // When loading ends, run the bar to the end and fade it out instead of cutting it off
  if (Boolean(pending) !== wasPending) {
    setWasPending(Boolean(pending));
    if (!pending) setFinishing(true);
  }
  useEffect(() => {
    if (!finishing) return;
    const t = setTimeout(() => setFinishing(false), 350);
    return () => clearTimeout(t);
  }, [finishing]);

  if (!pending && !finishing) return <LoaderStyles />;
  return (
    <>
      <LoaderStyles />
      <div
        className="nav-progress"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
        }}
        data-state={pending ? "loading" : "done"}
        role="progressbar"
        aria-label="Loading page"
      >
        <div className="nav-progress-fill">
          <span className="nav-progress-ball" style={{ width: 18, height: 18 }}>
            <Ball size={18} />
          </span>
        </div>
      </div>
    </>
  );
}

/** Covers the page with placeholder blocks and a bouncing ball when a page is slow to load. */
export function NavOverlay() {
  const pending = useNavPending();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pending) return setShow(false);
    const t = setTimeout(() => setShow(true), OVERLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending || !show) return <LoaderStyles />;
  const page = PAGES[pending] ??
    PAGES[`/${pending.split("/")[1]}`] ?? {
      title: "Page",
      detail: "Running the query",
    };
  return (
    <>
      <LoaderStyles />
      <div
        className="nav-overlay"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "var(--paper)",
        }}
        aria-live="polite"
      >
        <div className="nav-skeleton">
          {/* The ball sits in the hero block, where the page's title will appear */}
          <div className="nav-hero">
            <div className="nav-bounce-court" style={{ position: "relative", width: 120, height: 150 }} aria-hidden>
              <div className="nav-bounce-shadow" />
              <div className="nav-bounce-floor" />
              <div className="nav-bounce-ball" style={{ width: 48, height: 48 }}>
                <Ball size={48} />
              </div>
            </div>
            <span className="display text-[30px]">
              Loading {page.title}
              <span className="nav-dots" />
            </span>
            <span className="label text-muted">{page.detail}</span>
          </div>
          <div className="nav-sk" style={{ width: "55%", height: 28 }} aria-hidden />
          <div className="nav-sk" style={{ width: "35%" }} aria-hidden />
          <div className="nav-sk-row" aria-hidden>
            <div className="nav-sk nav-sk-card" />
            <div className="nav-sk nav-sk-card" />
          </div>
        </div>
      </div>
    </>
  );
}
