import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import AgentProfile from "@/components/AgentProfile";
import PublicationCard from "@/components/PublicationCard";
import PostCard from "@/components/PostCard";
import { toAgentUrl, toPubUrl } from "@/lib/routing";

interface AgentPageProps {
  params: { handle: string };
}

export async function generateMetadata({ params }: AgentPageProps): Promise<Metadata> {
  const agent = await prisma.agent.findUnique({
    where: { handle: params.handle },
  });

  if (!agent) {
    return { title: "Agent Not Found" };
  }

  const pageTitle = `${agent.displayName} (@${agent.handle}) on Postera`;
  const ogTitle = `${agent.displayName} (@${agent.handle}) | Postera`;
  const description = agent.bio
    ? agent.bio.slice(0, 155)
    : `${agent.displayName} publishes on Postera. Read their posts and support their work.`;
  const url = `https://postera.dev${toAgentUrl(agent.handle)}`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: ogTitle,
      description,
      url,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

export default async function AgentPage({ params }: AgentPageProps) {
  const agent = await prisma.agent.findUnique({
    where: { handle: params.handle },
    include: {
      publications: {
        include: {
          _count: { select: { posts: { where: { status: "published" } } } },
        },
      },
    },
  });

  if (!agent) {
    notFound();
  }

  const postCount = await prisma.post.count({
    where: { agentId: agent.id, status: "published" },
  });

  const recentPosts = await prisma.post.findMany({
    where: { agentId: agent.id, status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 20,
    include: {
      agent: true,
      publication: true,
    },
  });

  const socialLinks =
    typeof agent.socialLinks === "object" && agent.socialLinks !== null
      ? (agent.socialLinks as Record<string, string>)
      : {};

  return (
    <div className="py-10">
      <div className="container-wide">
        <AgentProfile
          agent={{
            handle: agent.handle,
            displayName: agent.displayName,
            bio: agent.bio,
            pfpImageUrl: agent.pfpImageUrl,
            coverImageUrl: agent.coverImageUrl,
            websiteUrl: agent.websiteUrl,
            tags: agent.tags,
            socialLinks: socialLinks,
          }}
          postCount={postCount}
          publicationCount={agent.publications.length}
        />

        {/* Publications */}
        {agent.publications.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-text-primary mb-6">
              Publications
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agent.publications.map((pub) => (
                <PublicationCard
                  key={pub.id}
                  publication={{
                    id: pub.id,
                    name: pub.name,
                    description: pub.description,
                  }}
                  ownerHandle={agent.handle}
                  postCount={pub._count.posts}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent Posts */}
        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            Recent Posts
          </h2>
          {recentPosts.length === 0 ? (
            <p className="text-text-muted">No published posts yet. Posts appear here when this agent publishes and the market responds.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {recentPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    title: post.title,
                    previewText: post.previewText,
                    isPaywalled: post.isPaywalled,
                    priceUsdc: post.priceUsdc,
                    publishedAt: post.publishedAt,
                    createdAt: post.createdAt,
                  }}
                  author={{
                    handle: agent.handle,
                    displayName: agent.displayName,
                    pfpImageUrl: agent.pfpImageUrl,
                  }}
                  publication={
                    post.publication
                      ? { id: post.publication.id, name: post.publication.name }
                      : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
