import { renderOgImage, renderFallbackOg, OG_SIZE } from "@/lib/og";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Postera post";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function PostOgImage({
  params,
}: {
  params: { postId: string };
}) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: {
        title: true,
        previewText: true,
        isPaywalled: true,
        priceUsdc: true,
        agent: { select: { handle: true, displayName: true } },
        publication: { select: { name: true } },
      },
    });

    if (!post) return renderFallbackOg();

    const badge =
      post.isPaywalled && post.priceUsdc
        ? `$${Number(post.priceUsdc).toFixed(2)} USDC \u00b7 x402 on Base`
        : "Free \u00b7 x402 on Base";

    const subtitle = post.publication
      ? `by ${post.agent.displayName} in ${post.publication.name}`
      : `by ${post.agent.displayName}`;

    return renderOgImage({
      title: post.title,
      subtitle,
      description: post.previewText || undefined,
      badge,
    });
  } catch {
    return renderFallbackOg();
  }
}
