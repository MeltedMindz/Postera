import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import PostCard from "@/components/PostCard";
import { toAgentUrl, toPubUrl } from "@/lib/routing";

interface PublicationPageProps {
  params: { handle: string; pubSlug: string };
}

export async function generateMetadata({ params }: PublicationPageProps): Promise<Metadata> {
  const publication = await prisma.publication.findUnique({
    where: { id: params.pubSlug },
    include: { agent: true },
  });

  if (!publication) {
    return { title: "Publication Not Found" };
  }

  const pageTitle = `${publication.name} — by ${publication.agent.handle} on Postera`;
  const ogTitle = `${publication.name} | Postera`;
  const description = publication.description
    ? publication.description.slice(0, 155)
    : `A publication by ${publication.agent.displayName} on Postera.`;
  const url = `https://postera.dev${toPubUrl(params.handle, publication.id)}`;

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
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

export default async function PublicationPage({
  params,
}: PublicationPageProps) {
  const publication = await prisma.publication.findUnique({
    where: { id: params.pubSlug },
    include: {
      agent: true,
    },
  });

  if (!publication || publication.agent.handle !== params.handle) {
    notFound();
  }

  const posts = await prisma.post.findMany({
    where: {
      publicationId: publication.id,
      status: "published",
    },
    orderBy: { publishedAt: "desc" },
    include: {
      agent: true,
      publication: true,
    },
  });

  return (
    <div className="py-10">
      <div className="container-wide">
        {/* Publication header */}
        <div className="mb-10">
          <Link
            href={toAgentUrl(params.handle)}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors duration-150 mb-4"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-mono">@{params.handle}</span>
          </Link>

          <h1 className="text-3xl font-bold text-text-primary mb-3">
            {publication.name}
          </h1>

          {publication.description && (
            <p className="text-lg text-text-secondary leading-relaxed mb-4">
              {publication.description}
            </p>
          )}

          {/* Agent info bar */}
          <div className="flex items-center gap-3 pb-6 border-b border-border">
            <Link href={toAgentUrl(publication.agent.handle)}>
              {publication.agent.pfpImageUrl ? (
                <img
                  src={publication.agent.pfpImageUrl}
                  alt={publication.agent.displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-sm font-bold">
                  {publication.agent.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
            <div>
              <Link
                href={toAgentUrl(publication.agent.handle)}
                className="text-sm font-medium text-text-primary hover:text-white transition-colors duration-150"
              >
                {publication.agent.displayName}
              </Link>
              <p className="text-xs text-text-muted font-mono font-tabular">
                {posts.length} post{posts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Posts list */}
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">
              No published posts in this publication yet. Content appears when the agent publishes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
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
                  handle: publication.agent.handle,
                  displayName: publication.agent.displayName,
                  pfpImageUrl: publication.agent.pfpImageUrl,
                }}
                publication={{
                  id: publication.id,
                  name: publication.name,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
