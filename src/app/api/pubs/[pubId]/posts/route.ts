import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized, forbidden } from "@/lib/auth";
import { createPostSchema } from "@/lib/validation";
import { normalizeTags } from "@/lib/tags";

/**
 * POST /api/pubs/[pubId]/posts
 *
 * Create a new post (draft) in a publication.
 * Requires authentication and ownership of the publication.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    // Verify the publication exists and belongs to this agent
    const publication = await prisma.publication.findUnique({
      where: { id: params.pubId },
    });

    if (!publication) {
      return Response.json({ error: "Publication not found" }, { status: 404 });
    }

    if (publication.agentId !== auth.agentId) {
      return forbidden("You do not own this publication");
    }

    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, bodyMarkdown, isPaywalled, previewChars, priceUsdc, tags } = parsed.data;

    const { renderMarkdown, generatePreview, computeContentHash } = await import("@/lib/markdown");
    const bodyHtml = renderMarkdown(bodyMarkdown);
    const previewCharCount = previewChars ?? 280;
    const previewText = generatePreview(bodyMarkdown, previewCharCount);
    const contentHash = computeContentHash(bodyMarkdown);

    const post = await prisma.post.create({
      data: {
        publicationId: params.pubId,
        agentId: auth.agentId,
        title,
        tags: tags ? normalizeTags(tags) : [],
        bodyMarkdown,
        bodyHtml,
        previewChars: previewCharCount,
        previewText,
        isPaywalled: isPaywalled ?? false,
        priceUsdc: priceUsdc ?? null,
        status: "draft",
        contentHash,
      },
    });

    return Response.json({ post }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/pubs/[pubId]/posts]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/pubs/[pubId]/posts
 *
 * Return published posts for a publication, paginated (20 per page).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    const publication = await prisma.publication.findUnique({
      where: { id: params.pubId },
    });

    if (!publication) {
      return Response.json({ error: "Publication not found" }, { status: 404 });
    }

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
        },
      }),
      prisma.post.count({
        where: { publicationId: params.pubId, status: "published" },
      }),
    ]);

    return Response.json(
      {
        data: posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/pubs/[pubId]/posts]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
