import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site";

export const metadata: Metadata = {
  title: { default: "Courtside Analytics", template: "%s · Courtside Analytics" },
  description: "NBA team, player and schedule analytics for front-office decisions, refreshed from nba_api.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
