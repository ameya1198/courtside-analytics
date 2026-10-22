import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * Clears every cached page query, so a finished data refresh shows up at once instead of within the hour.
 * Called by scripts/nightly_refresh.sh with `Authorization: Bearer $REVALIDATE_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ ok: false }, { status: 401 });
  revalidateTag("warehouse");
  return Response.json({ ok: true, at: new Date().toISOString() });
}
