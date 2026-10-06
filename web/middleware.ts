import { NextResponse, type NextRequest } from "next/server";

// Pages that work before a team is picked: the landing page and the team picker.
const OPEN = new Set(["/", "/pick"]);

// Until a team is picked, every other page sends the visitor to the landing page.
export function middleware(req: NextRequest) {
  if (!OPEN.has(req.nextUrl.pathname) && !req.cookies.get("courtside_team")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

// Skip Next.js internals and files with an extension (favicon, images).
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };
