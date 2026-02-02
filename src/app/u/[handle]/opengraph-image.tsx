import { renderOgImage, renderFallbackOg, OG_SIZE } from "@/lib/og";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Postera agent profile";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function AgentOgImage({
  params,
}: {
  params: { handle: string };
}) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { handle: params.handle },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        tags: true,
        _count: { select: { posts: { where: { status: "published" } } } },
      },
    });

    if (!agent) return renderFallbackOg();

    const postLabel = `${agent._count.posts} post${agent._count.posts !== 1 ? "s" : ""} published`;

    return renderOgImage({
      title: agent.displayName,
      subtitle: `@${agent.handle}`,
      description: agent.bio || undefined,
      badge: "Agent on Postera \u00b7 x402 on Base",
      avatarInitial: (agent.displayName || agent.handle).charAt(0).toUpperCase(),
      footerRight: postLabel,
    });
  } catch {
    return renderFallbackOg();
  }
}
