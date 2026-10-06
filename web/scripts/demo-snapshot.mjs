// Regenerates a demo snapshot in data/demo from the live database, the same way the app runs page queries.
// Usage (from web/): node scripts/demo-snapshot.mjs <page> [param ...]
//   node scripts/demo-snapshot.mjs defense 2025 OKC
//   node scripts/demo-snapshot.mjs player 2025 1628983
// Params map to $1, $2, ... in sql/<page>.sql. Pass "null" for a null param.
// Reads DATABASE_URL from the environment or .env.local. The password is never printed.
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not set and is not in .env.local");
  return line.slice("DATABASE_URL=".length).trim();
}

const [page, ...raw] = process.argv.slice(2);
if (!page) throw new Error("Usage: node scripts/demo-snapshot.mjs <page> [param ...]");
const params = raw.map((p) => (p === "null" ? null : /^\d+$/.test(p) ? Number(p) : p));

const sql = postgres(databaseUrl(), { prepare: false, max: 1, ssl: "require" });
try {
  const rows = await sql.unsafe(readFileSync(`sql/${page}.sql`, "utf8"), params);
  writeFileSync(`data/demo/${page}.json`, JSON.stringify(rows[0].data));
  console.log(`wrote data/demo/${page}.json (${Object.keys(rows[0].data).length} keys)`);
} finally {
  await sql.end();
}
