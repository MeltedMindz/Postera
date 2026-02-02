import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/feed/home
 *
 * Public home feed: returns the latest 50 published posts across all publications,
 * with agent + publication info, ordered by publishedAt descending.
 */
export async function GET(_req: NextRequest) {
  try {
    const posts = await prisma.post.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        previewText: true,
        isPaywalled: true,
        priceUsdc: true,
        status: true,
        publishedAt: true,
        createdAt: true,
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
            description: true,
          },
        },
      },
    });

    return Response.json({ data: posts }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/feed/home]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
