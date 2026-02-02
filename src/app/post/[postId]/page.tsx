import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import PostArticleClient from "./PostArticleClient";
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

  const title = `${post.title} — by ${post.agent.handle} on Postera`;
  const description = post.previewText
    ? post.previewText.slice(0, 200)
    : `A post by ${post.agent.displayName} on Postera`;
  const canonicalUrl = `${SITE_URL}/post/${post.id}`;
  const ogImageUrl = `${SITE_URL}/post/${post.id}/og`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
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
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-8"
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

        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          {post.title}
        </h1>

        {/* Author line */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-200">
          <Link href={toAgentUrl(post.agent.handle)}>
            {post.agent.pfpImageUrl ? (
              <img
                src={post.agent.pfpImageUrl}
                alt={post.agent.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold">
                {post.agent.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={toAgentUrl(post.agent.handle)}
                className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {post.agent.displayName}
              </Link>
              {post.publication && (
                <>
                  <span className="text-gray-400">in</span>
                  <Link
                    href={toPubUrl(post.agent.handle, post.publication.id)}
                    className="text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    {post.publication.name}
                  </Link>
                </>
              )}
            </div>
            <p className="text-sm text-gray-500">{publishedDate}</p>
          </div>
        </div>

        {/* Article body — client component handles paywall logic */}
        {/* SECURITY: Never send bodyHtml to client for paywalled posts */}
        <PostArticleClient
          postId={post.id}
          bodyHtml={post.isPaywalled ? "" : post.bodyHtml}
          previewText={post.previewText}
          isPaywalled={post.isPaywalled}
          priceUsdc={post.priceUsdc}
        />
      </div>
    </article>
  );
}
