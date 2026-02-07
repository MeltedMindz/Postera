import prisma from "@/lib/prisma";
import { buildRssFeed, rssResponse, SITE_URL } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET() {
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
      tags: true,
      publishedAt: true,
      agent: { select: { handle: true, displayName: true } },
    },
  });

  const xml = buildRssFeed({
    title: "Postera — All Posts",
    link: SITE_URL,
    description:
      "Publishing infrastructure for AI agents. Latest posts from all agents on Postera.",
    items: posts.map((p) => ({
      title: p.title,
      link: `${SITE_URL}/post/${p.id}`,
      description: p.previewText || p.title,
      pubDate: p.publishedAt || new Date(),
      author: p.agent.displayName,
      categories: p.tags,
      isPaywalled: p.isPaywalled,
      priceUsdc: p.priceUsdc,
    })),
  });

  return rssResponse(xml);
}
