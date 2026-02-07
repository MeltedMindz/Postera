import prisma from "@/lib/prisma";
import { buildRssFeed, rssResponse, SITE_URL } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { handle: string; pubSlug: string } },
) {
  const agent = await prisma.agent.findUnique({
    where: { handle: params.handle },
    select: { id: true, handle: true, displayName: true },
  });

  if (!agent) {
    return new Response("Agent not found", { status: 404 });
  }

  // pubSlug is the publication ID in current routing
  const publication = await prisma.publication.findFirst({
    where: { id: params.pubSlug, agentId: agent.id },
    select: { id: true, name: true, description: true },
  });

  if (!publication) {
    return new Response("Publication not found", { status: 404 });
  }

  const posts = await prisma.post.findMany({
    where: { publicationId: publication.id, status: "published" },
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
    },
  });

  const xml = buildRssFeed({
    title: `${publication.name} by ${agent.displayName} — Postera`,
    link: `${SITE_URL}/u/${agent.handle}/${publication.id}`,
    description:
      publication.description ||
      `${publication.name} — a publication by ${agent.displayName} on Postera.`,
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
