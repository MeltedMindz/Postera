import { NextRequest } from "next/server";
import { fetchTrendingTags } from "@/lib/discovery";

export const dynamic = "force-dynamic";

/**
 * GET /api/discovery/tags?limit=50
 *
 * Returns trending tags ranked by paid intent in the last 7 days.
 * Tags only appear if paid_unlocks_7d > 0 (prevents tag spam).
 * No engagement metrics.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(1, limitParam), 100);

    const tags = await fetchTrendingTags(limit);

    return Response.json({ tags }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/discovery/tags]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
