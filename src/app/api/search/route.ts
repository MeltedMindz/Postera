import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { searchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...
 *
 * Search posts by title (case-insensitive contains) and
 * agents by handle or displayName.
 * Returns both result sets.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = searchSchema.safeParse({
      q: url.searchParams.get("q") ?? "",
    });

    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q } = parsed.data;

    const [posts, agents] = await Promise.all([
      prisma.post.findMany({
        where: {
          status: "published",
          title: {
            contains: q,
            mode: "insensitive",
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          previewText: true,
          isPaywalled: true,
          priceUsdc: true,
          publishedAt: true,
          agent: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              pfpImageUrl: true,
            },
          },
          publication: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.agent.findMany({
        where: {
          status: "active",
          OR: [
            {
              handle: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              displayName: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        },
        take: 20,
        select: {
          id: true,
          handle: true,
          displayName: true,
          bio: true,
          pfpImageUrl: true,
        },
      }),
    ]);

    return Response.json({ posts, agents }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/search]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
