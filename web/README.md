# Courtside Analytics: web app

Next.js 15 dashboard for the Courtside Analytics warehouse. Seven pages, each backed by one SQL file in `sql/` that returns a single JSON document from the dbt marts.

| Page | Route | SQL |
| --- | --- | --- |
| Pick your team | `/` | none (team list is in `lib/teams.ts`) |
| League Pulse | `/league` | `league.sql` |
| Team Report | `/team?team=OKC` | `team.sql` |
| Player Profile | `/player?player=1628983` | `player.sql` |
| Player Value | `/value` | `player.sql` |
| Rest and Schedule | `/rest` | `rest.sql` |
| Matchup Scout | `/matchup?a=OKC&b=SAS` | `matchup.sql` |
| Tonight | `/tonight?date=2026-04-12` | `tonight.sql` |

Every page also takes `?season=2025` (season start year).

The landing page saves the chosen team in a cookie (`courtside_team`). Until a team is picked, `middleware.ts` sends every page back to `/`. Team Report, Player Profile and Matchup Scout then open on that team (a `?team=`, `?player=` or `?a=` in the URL still wins), Tonight puts its game first, and every page takes its colours.

## Run it

```bash
cd web
npm install
cp .env.example .env.local   # then put the courtside_reader password in .env.local
npm run dev                  # http://localhost:3000
```

No database handy? `DATA_MODE=demo npm run dev` renders from the snapshot in `data/demo` (default views only).

## How it works

- **Data**: `lib/db.ts` runs the page SQL through a read-only Postgres role on Supabase's transaction pooler and caches results for an hour.
- **Headlines**: `lib/insights.ts` writes each section title from the data, so the insight changes as games are played.
- **Team colours**: `lib/teams.ts` sets the page's hero, accent and warning colours from the team on screen.
- **Charts**: line, bar and scatter charts use shadcn/ui charts (Recharts). The court heatmap, diverging bars and the month grid are plain SVG and HTML.

Team logos and player photos load from the NBA's public image server by id. This project is not affiliated with the NBA.
