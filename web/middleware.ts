import { NextResponse, type NextRequest } from "next/server";

// Until a team is picked, every page sends the visitor to the landing page ("/").
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname !== "/" && !req.cookies.get("courtside_team")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

// Skip Next.js internals and files with an extension (favicon, images).
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };
