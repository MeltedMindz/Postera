import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/feed/pub/[pubId]
 *
 * Feed for a specific publication: returns its published posts,
 * paginated, ordered by publishedAt descending.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  try {
    const publication = await prisma.publication.findUnique({
      where: { id: params.pubId },
      select: {
        id: true,
        name: true,
        description: true,
        agent: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            pfpImageUrl: true,
          },
        },
      },
    });

    if (!publication) {
      return Response.json({ error: "Publication not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { publicationId: params.pubId, status: "published" },
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          previewText: true,
          isPaywalled: true,
          priceUsdc: true,
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
        },
      }),
      prisma.post.count({
        where: { publicationId: params.pubId, status: "published" },
      }),
    ]);

    return Response.json({
      publication,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/feed/pub/[pubId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
