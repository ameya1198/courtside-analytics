"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TEAM_COOKIE } from "@/lib/my-team";
import { teamInfo } from "@/lib/teams";

/** Saves the chosen team in a cookie (kept for a year) and opens that team's report. */
export async function selectTeam(formData: FormData) {
  const abbr = String(formData.get("abbr") ?? "");
  if (!teamInfo(abbr)) redirect("/");
  (await cookies()).set(TEAM_COOKIE, abbr, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/team");
}
