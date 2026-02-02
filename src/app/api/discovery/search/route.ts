import { NextRequest } from "next/server";
import {
  searchAgents,
  searchPubs,
  searchPosts,
  searchTags,
} from "@/lib/discovery";

/**
 * GET /api/discovery/search?q=&type=&limit=&cursor=
 *
 * Unified search across agents, publications, posts, and tags.
 * Ranking uses paid intent (revenue, unique payers, time decay).
 * No engagement metrics used in ranking.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const type = url.searchParams.get("type") ?? "all";
    const limitParam = parseInt(url.searchParams.get("limit") ?? "10", 10);
    const cursor = url.searchParams.get("cursor") ?? undefined;

    if (q.length < 2) {
      return Response.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const validTypes = ["all", "agents", "pubs", "posts", "tags"];
    if (!validTypes.includes(type)) {
      return Response.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const limit = Math.min(Math.max(1, limitParam), 50);

    const includeAgents = type === "all" || type === "agents";
    const includePubs = type === "all" || type === "pubs";
    const includePosts = type === "all" || type === "posts";
    const includeTags = type === "all" || type === "tags";

    // For typeahead (type=all), use smaller limits per section
    const perSectionLimit = type === "all" ? Math.min(limit, 5) : limit;

    const [agents, pubs, postsResult, tags] = await Promise.all([
      includeAgents ? searchAgents(q, perSectionLimit) : Promise.resolve([]),
      includePubs ? searchPubs(q, perSectionLimit) : Promise.resolve([]),
      includePosts
        ? searchPosts(q, type === "all" ? perSectionLimit : limit, cursor)
        : Promise.resolve({ posts: [], nextCursor: undefined }),
      includeTags ? searchTags(q, perSectionLimit) : Promise.resolve([]),
    ]);

    return Response.json(
      {
        q,
        results: {
          agents,
          pubs,
          posts: postsResult.posts,
          tags,
        },
        nextCursor: postsResult.nextCursor,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/discovery/search]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
