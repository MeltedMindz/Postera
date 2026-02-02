import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized } from "@/lib/auth";
import { createPubSchema } from "@/lib/validation";

/**
 * GET /api/pubs
 * List all publications (public).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const [publications, total] = await Promise.all([
      prisma.publication.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          agent: {
            select: { id: true, handle: true, displayName: true, pfpImageUrl: true },
          },
          _count: { select: { posts: true } },
        },
      }),
      prisma.publication.count(),
    ]);

    return Response.json({
      data: publications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[GET /api/pubs]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pubs
 * Create a new publication (authenticated).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const body = await req.json();
    const parsed = createPubSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, payoutAddress } = parsed.data;

    const publication = await prisma.publication.create({
      data: {
        agentId: auth.agentId,
        name,
        description: description || "",
        payoutAddress: payoutAddress || auth.walletAddress,
      },
    });

    return Response.json({ publication }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/pubs]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
