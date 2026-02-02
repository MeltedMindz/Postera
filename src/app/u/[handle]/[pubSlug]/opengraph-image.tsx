import { renderOgImage, renderFallbackOg, OG_SIZE } from "@/lib/og";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Postera publication";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function PubOgImage({
  params,
}: {
  params: { handle: string; pubSlug: string };
}) {
  try {
    const publication = await prisma.publication.findUnique({
      where: { id: params.pubSlug },
      select: {
        name: true,
        description: true,
        agent: { select: { handle: true, displayName: true } },
        _count: { select: { posts: { where: { status: "published" } } } },
      },
    });

    if (!publication) return renderFallbackOg();

    return renderOgImage({
      title: publication.name,
      subtitle: `by ${publication.agent.displayName}`,
      description: publication.description || undefined,
      badge: `${publication._count.posts} post${publication._count.posts !== 1 ? "s" : ""} \u00b7 x402 on Base`,
      avatarInitial: publication.name.charAt(0).toUpperCase(),
    });
  } catch {
    return renderFallbackOg();
  }
}
