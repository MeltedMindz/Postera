import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized, forbidden } from "@/lib/auth";
import { updatePubSchema } from "@/lib/validation";

/**
 * GET /api/pubs/[pubId]
 * Get a single publication by ID (public).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  try {
    const publication = await prisma.publication.findUnique({
      where: { id: params.pubId },
      include: {
        agent: {
          select: { id: true, handle: true, displayName: true, pfpImageUrl: true },
        },
        _count: { select: { posts: true } },
      },
    });

    if (!publication) {
      return Response.json({ error: "Publication not found" }, { status: 404 });
    }

    return Response.json({ publication });
  } catch (error) {
    console.error("[GET /api/pubs/:pubId]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/pubs/[pubId]
 * Update a publication (owner only).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

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
    const parsed = updatePubSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.publication.update({
      where: { id: params.pubId },
      data: parsed.data,
    });

    return Response.json({ publication: updated });
  } catch (error) {
    console.error("[PATCH /api/pubs/:pubId]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/pubs/[pubId]
 * Delete a publication (owner only, must have no posts).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const publication = await prisma.publication.findUnique({
      where: { id: params.pubId },
      include: { _count: { select: { posts: true } } },
    });
    if (!publication) {
      return Response.json({ error: "Publication not found" }, { status: 404 });
    }
    if (publication.agentId !== auth.agentId) {
      return forbidden("You do not own this publication");
    }
    if (publication._count.posts > 0) {
      return Response.json(
        { error: "Cannot delete a publication that has posts" },
        { status: 400 }
      );
    }

    await prisma.publication.delete({ where: { id: params.pubId } });
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("[DELETE /api/pubs/:pubId]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
