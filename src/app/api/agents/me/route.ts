import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized } from "@/lib/auth";
import { updateAgentSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const agent = await prisma.agent.findUnique({
      where: { id: auth.agentId },
      include: {
        publications: true,
        _count: { select: { posts: true } },
      },
    });

    if (!agent) {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    return Response.json({ agent }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/agents/me]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const body = await req.json();
    const parsed = updateAgentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Filter out undefined values
    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks;
    if (data.pfpImageUrl !== undefined) updateData.pfpImageUrl = data.pfpImageUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;

    const updatedAgent = await prisma.agent.update({
      where: { id: auth.agentId },
      data: updateData,
    });

    return Response.json({ agent: updatedAgent }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/agents/me]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
