import { Suspense } from "react";
import { NavOverlay, NavWatcher } from "@/components/nav-progress";
import { SiteHeader, SiteFooter } from "@/components/site";
import { myTeam } from "@/lib/my-team";
import { teamTheme } from "@/lib/teams";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The page loader sits outside each page's team theme, so it gets the team colour here
  const mine = await myTeam();
  const navAccent = { "--nav-accent": teamTheme(mine?.abbr)["--accent" as keyof React.CSSProperties] } as React.CSSProperties;
  return (
    <div style={navAccent}>
      <SiteHeader />
      <main className="relative">
        {children}
        <NavOverlay />
      </main>
      <Suspense fallback={null}>
        <NavWatcher />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
