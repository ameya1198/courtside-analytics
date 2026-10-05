import "server-only";
import { cookies } from "next/headers";
import { teamInfo } from "./teams";

export const TEAM_COOKIE = "courtside_team";

/** The team the visitor picked on the landing page, or null if they have not picked one. */
export async function myTeam() {
  const abbr = (await cookies()).get(TEAM_COOKIE)?.value;
  return teamInfo(abbr) ?? null;
}
