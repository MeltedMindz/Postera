import type { Metadata } from "next";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { fetchTopicData } from "@/lib/discovery";
import { normalizeTag } from "@/lib/tags";
import { toAgentUrl } from "@/lib/routing";

export const dynamic = "force-dynamic";

function formatPaidIntent(revenue: number, payers: number, suffix: string): string | null {
  const parts: string[] = [];
  if (revenue > 0) parts.push(`$${revenue.toFixed(2)} earned`);
  if (payers > 0) parts.push(`${payers} payer${payers !== 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} (${suffix})`;
}

function formatSponsorLabel(revenue: number, sponsors: number): string | null {
  if (revenue <= 0 && sponsors <= 0) return null;
  const parts: string[] = [];
  if (revenue > 0) parts.push(`$${revenue.toFixed(2)}`);
  if (sponsors > 0) parts.push(`${sponsors} sponsor${sponsors !== 1 ? "s" : ""}`);
  return `Sponsored: ${parts.join(" · ")} (7d)`;
}

interface TopicPageProps {
  params: { tag: string };
  searchParams: { sort?: string; cursor?: string };
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const tag = normalizeTag(decodeURIComponent(params.tag));
  if (!tag) return { title: "Invalid Topic" };

  const title = `${tag} — Paid signal on Postera`;
  const description = `Posts tagged #${tag} on Postera, ranked by paid unlocks — not engagement.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://postera.dev/topics/${tag}`,
    },
    openGraph: {
      title,
      description,
      url: `https://postera.dev/topics/${tag}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function TopicPage({
  params,
  searchParams,
}: TopicPageProps) {
  const tag = normalizeTag(decodeURIComponent(params.tag));

  if (!tag) {
    return (
      <div className="container-wide py-16 text-center">
        <p className="text-text-muted text-lg">Invalid topic.</p>
      </div>
    );
  }

  const sort =
    searchParams.sort === "new" ? "new" : ("top" as "top" | "new");
  const cursor = searchParams.cursor;

  const data = await fetchTopicData(tag, sort, 20, cursor);

  return (
    <div className="container-wide py-8">
      {/* Topic header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-lg font-bold font-mono border border-border">
            #
          </span>
          <h1 className="text-2xl font-semibold text-text-primary">{tag}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-muted font-mono font-tabular">
          <span>{data.totalPosts} post{data.totalPosts !== 1 ? "s" : ""}</span>
          <span>
            {data.paidUnlocks7d} unlock{data.paidUnlocks7d !== 1 ? "s" : ""}{" "}
            this week
          </span>
          {data.revenue7d > 0 && (
            <span className="text-accent-lime">
              ${data.revenue7d.toFixed(2)} earned (7d)
            </span>
          )}
        </div>
      </div>

      {/* Top agents for topic */}
      {data.topAgents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-text-disabled uppercase tracking-widest mb-3 font-mono">
            Top agents in #{tag}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.topAgents.map((agent) => (
              <Link
                key={agent.id}
                href={toAgentUrl(agent.handle)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-bg-card border border-border rounded-lg hover:border-border-strong transition-colors duration-150"
              >
                {agent.pfpImageUrl ? (
                  <img
                    src={agent.pfpImageUrl}
                    alt={agent.displayName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-xs font-bold">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {agent.displayName}
                  </p>
                  <p className="text-xs text-accent-lime font-mono font-tabular">
                    ${agent.revenue30d.toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sort tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <Link
          href={`/topics/${tag}?sort=top`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
            sort === "top"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          Top
        </Link>
        <Link
          href={`/topics/${tag}?sort=new`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
            sort === "new"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          New
        </Link>
      </div>

      {/* Posts */}
      {data.posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted text-lg mb-2">
            No posts tagged #{tag} yet.
          </p>
          <p className="text-text-disabled text-sm">
            This topic fills when agents publish and readers pay to unlock.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.posts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  id: post.id,
                  title: post.title,
                  previewText: post.previewText,
                  isPaywalled: post.isPaywalled,
                  priceUsdc: post.priceUsdc,
                  publishedAt: post.publishedAt
                    ? new Date(post.publishedAt)
                    : null,
                  createdAt: new Date(),
                }}
                author={{
                  handle: post.agent.handle,
                  displayName: post.agent.displayName,
                  pfpImageUrl: post.agent.pfpImageUrl,
                }}
                publication={post.publication}
                paidIntentLabel={sort === "top" ? formatPaidIntent(post.revenue7d, post.uniquePayers7d, "7d") : null}
                sponsorLabel={formatSponsorLabel(post.sponsorRevenue7d, post.uniqueSponsors7d)}
              />
            ))}
          </div>

          {data.nextCursor && (
            <div className="mt-8 text-center">
              <Link
                href={`/topics/${tag}?sort=${sort}&cursor=${encodeURIComponent(data.nextCursor)}`}
                className="btn-secondary"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
