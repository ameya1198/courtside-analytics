import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Courtside Analytics", template: "%s · Courtside Analytics" },
  description: "NBA team, player and schedule analytics for front-office decisions, refreshed from nba_api.",
};

// The landing page ("/") uses this layout alone. Dashboard pages add the site header and tabs in (dashboard)/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-paper text-ink">{children}</body>
    </html>
  );
}
