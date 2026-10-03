import Link from "next/link";
import { Suspense } from "react";
import { isDemo } from "@/lib/db";
import { NavTabs } from "./nav-tabs";

export function SiteHeader() {
  return (
    <header>
      <div className="flex flex-wrap items-stretch justify-between bg-ink text-white">
        <Link href="/" className="display bg-white px-5 py-3 text-[22px] tracking-[0.04em] text-ink md:px-7">
          Courtside
        </Link>
        <div className="label flex items-center gap-3 px-5 py-3 text-[#A7AEBB] md:px-7">
          {isDemo ? <span className="bg-white px-2 py-0.5 text-ink">Demo snapshot</span> : null}
          <span>NBA analytics · nba_api</span>
        </div>
      </div>
      <Suspense fallback={<div className="h-[52px] border-b-[3px] border-ink" />}>
        <NavTabs />
      </Suspense>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-8 text-[13px] text-muted md:flex-row md:justify-between md:px-12">
        <span>Data: NBA stats via nba_api, modelled in dbt on Supabase Postgres. Refreshed nightly.</span>
        <span>Not affiliated with or endorsed by the NBA. Team logos and player photos belong to their owners.</span>
      </div>
    </footer>
  );
}
