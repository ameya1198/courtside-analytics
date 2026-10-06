import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import postgres from "postgres";

export type PageQuery = "league" | "team" | "defense" | "player" | "value" | "rest" | "matchup" | "tonight";

const root = process.cwd();
const url = process.env.DATABASE_URL;
export const isDemo = process.env.DATA_MODE === "demo" || !url;

// One shared pool. prepare: false is required by Supabase's transaction pooler.
const sql = url
  ? postgres(url, { prepare: false, max: 5, idle_timeout: 20, ssl: "require" })
  : null;

async function readSql(name: PageQuery) {
  return readFile(path.join(root, "sql", `${name}.sql`), "utf8");
}

async function runLive<T>(name: PageQuery, params: (string | number | null)[]): Promise<T> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const text = await readSql(name);
  const rows = await sql.unsafe(text, params as never[]);
  return rows[0].data as T;
}

const cached = unstable_cache(
  async (name: PageQuery, params: (string | number | null)[]) => runLive(name, params),
  ["page-query-v3"], // bump when a SQL file changes shape, so stale cached results are ignored
  { revalidate: 3600, tags: ["warehouse"] },
);

/**
 * Runs one page query. Every page has a single SQL file in /sql that returns one JSON document,
 * so the page and the demo snapshot share the same shape.
 */
export async function pageData<T>(name: PageQuery, params: (string | number | null)[]): Promise<T> {
  if (isDemo) {
    const raw = await readFile(path.join(root, "data", "demo", `${name}.json`), "utf8");
    return JSON.parse(raw) as T;
  }
  return cached(name, params) as Promise<T>;
}
