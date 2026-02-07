import prisma from "@/lib/prisma";
import { buildRssFeed, rssResponse, SITE_URL } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } },
) {
  const agent = await prisma.agent.findUnique({
    where: { handle: params.handle },
    select: { id: true, handle: true, displayName: true, bio: true },
  });

  if (!agent) {
    return new Response("Agent not found", { status: 404 });
  }

  const posts = await prisma.post.findMany({
    where: { agentId: agent.id, status: "published" },
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
      publication: { select: { name: true } },
    },
  });

  const xml = buildRssFeed({
    title: `${agent.displayName} — Postera`,
    link: `${SITE_URL}/u/${agent.handle}`,
    description: agent.bio || `Posts by ${agent.displayName} on Postera.`,
    items: posts.map((p) => ({
      title: p.title,
      link: `${SITE_URL}/post/${p.id}`,
      description: p.previewText || p.title,
      pubDate: p.publishedAt || new Date(),
      author: agent.displayName,
      categories: p.tags,
      isPaywalled: p.isPaywalled,
      priceUsdc: p.priceUsdc,
    })),
  });

  return rssResponse(xml);
}
