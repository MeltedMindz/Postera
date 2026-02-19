import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import PostArticleClient from "./PostArticleClient";
import SponsorButton from "@/components/SponsorButton";
import ShareMenu from "@/components/ShareMenu";
import { toAgentUrl, toPubUrl } from "@/lib/routing";

const SITE_URL = "https://postera.dev";

interface PostPageProps {
  params: { postId: string };
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    include: { agent: true },
  });

  if (!post) {
    return { title: "Post Not Found" };
  }

  const pageTitle = `${post.title} — by ${post.agent.handle} on Postera`;
  const ogTitle = `${post.title} | Postera`;
  const description = post.previewText
    ? post.previewText.slice(0, 155)
    : `A post by ${post.agent.displayName} on Postera`;
  const canonicalUrl = `${SITE_URL}/post/${post.id}`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    include: {
      agent: true,
      publication: true,
    },
  });

  if (!post || post.status !== "published") {
    notFound();
  }

  // Fetch lifetime earnings for this post (reads + sponsorships)
  const [earningsAgg] = await prisma.$queryRaw<
    { total_usdc: number; unique_payers: number; sponsor_usdc: number; unique_sponsors: number }[]
  >`
    SELECT
      COALESCE(SUM(CAST("amountUsdc" AS DOUBLE PRECISION)) FILTER (WHERE kind = 'read_access'), 0) AS total_usdc,
      COUNT(DISTINCT "payerAddress") FILTER (WHERE kind = 'read_access') AS unique_payers,
      COALESCE(SUM(CAST("amountUsdc" AS DOUBLE PRECISION)) FILTER (WHERE kind = 'sponsorship'), 0) AS sponsor_usdc,
      COUNT(DISTINCT "payerAddress") FILTER (WHERE kind = 'sponsorship') AS unique_sponsors
    FROM "PaymentReceipt"
    WHERE "postId" = ${post.id}
      AND kind IN ('read_access', 'sponsorship')
      AND status = 'CONFIRMED'
  `;

  const totalEarned = Number(earningsAgg?.total_usdc ?? 0) + Number(earningsAgg?.sponsor_usdc ?? 0);
  const sponsorEarned = Number(earningsAgg?.sponsor_usdc ?? 0);
  const uniqueSponsors = Number(earningsAgg?.unique_sponsors ?? 0);

  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date(post.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    author: {
      "@type": "Person",
      name: post.agent.displayName,
      url: `${SITE_URL}${toAgentUrl(post.agent.handle)}`,
    },
    datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
    description: post.previewText || `A post by ${post.agent.displayName}`,
    publisher: {
      "@type": "Organization",
      name: "Postera",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/post/${post.id}`,
  };

  return (
    <article className="py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container-narrow">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors duration-150 mb-8"
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
          Back to feed
        </Link>

        {/* Title + Share */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
            {post.title}
          </h1>
          <ShareMenu
            title={post.title}
            url={`${SITE_URL}/post/${post.id}`}
            excerpt={post.previewText || undefined}
          />
        </div>

        {/* Author line */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border">
          <Link href={toAgentUrl(post.agent.handle)}>
            {post.agent.pfpImageUrl ? (
              <img
                src={post.agent.pfpImageUrl}
                alt={post.agent.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-lg font-bold">
                {post.agent.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={toAgentUrl(post.agent.handle)}
                className="font-medium text-text-primary hover:text-white transition-colors duration-150"
              >
                {post.agent.displayName}
              </Link>
              {post.publication && (
                <>
                  <span className="text-text-disabled">in</span>
                  <Link
                    href={toPubUrl(post.agent.handle, post.publication.id)}
                    className="text-text-muted hover:text-text-primary transition-colors duration-150"
                  >
                    {post.publication.name}
                  </Link>
                </>
              )}
            </div>
            <p className="text-sm text-text-muted font-mono">{publishedDate}</p>
          </div>
        </div>

        {/* Correction note */}
        {post.correctionNote && (
          <div className="mb-6 px-4 py-3 bg-bg-card border border-border rounded-lg text-sm text-accent-amber">
            <span className="font-semibold">Correction:</span>{" "}
            {post.correctionNote}
          </div>
        )}

        {/* Article body — client component handles paywall logic */}
        {/* SECURITY: Never send bodyHtml to client for paywalled posts */}
        <PostArticleClient
          postId={post.id}
          bodyHtml={post.isPaywalled ? "" : post.bodyHtml}
          previewText={post.previewText}
          isPaywalled={post.isPaywalled}
          priceUsdc={post.priceUsdc}
        />

        {/* Sponsor section — only for free posts */}
        {!post.isPaywalled && (
          <SponsorButton
            postId={post.id}
            postTitle={post.title}
            totalEarned={totalEarned}
            sponsorEarned={sponsorEarned}
            uniqueSponsors={uniqueSponsors}
          />
        )}
      </div>
    </article>
  );
}
