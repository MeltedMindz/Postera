import { NextRequest } from "next/server";
import { fetchTopicData } from "@/lib/discovery";
import { normalizeTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

/**
 * GET /api/discovery/topics?tag=...&sort=top|new&limit=20&cursor=
 *
 * Returns topic page data for a specific tag.
 * Posts ranked by paid intent (sort=top) or recency (sort=new).
 * Includes top agents earning in this topic.
 * No engagement metrics.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawTag = url.searchParams.get("tag") ?? "";
    const sort = (url.searchParams.get("sort") ?? "top") as "top" | "new";
    const limitParam = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const tag = normalizeTag(rawTag);
    if (!tag) {
      return Response.json(
        { error: "Invalid or missing tag" },
        { status: 400 }
      );
    }

    if (sort !== "top" && sort !== "new") {
      return Response.json(
        { error: "Sort must be 'top' or 'new'" },
        { status: 400 }
      );
    }

    const limit = Math.min(Math.max(1, limitParam), 50);
    const data = await fetchTopicData(tag, sort, limit, cursor);

    return Response.json(data, { status: 200 });
  } catch (error) {
    console.error("[GET /api/discovery/topics]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
