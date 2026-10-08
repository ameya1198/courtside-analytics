export const signed = (n: number, digits = 1) => (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(digits);
export const pct = (n: number, digits = 1) => (n * 100).toFixed(digits) + "%";
export const dec3 = (n: number) => n.toFixed(3).replace(/^0/, "");
export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const seasonOptions = (seasons: number[]) =>
  seasons.map((s) => ({ value: String(s), label: `${s}-${String((s + 1) % 100).padStart(2, "0")}` }));
export const shortDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const longDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
export const parseSeason = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 1990 && n < 2100 ? n : null;
};
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

// Name suffixes that are not a surname: "Jimmy Butler III" -> "Butler", "Jaren Jackson Jr." -> "Jackson"
const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
/** A player's surname for headlines and chart labels, skipping Jr., III and the like. */
export const lastName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts[parts.length - 1];
};
