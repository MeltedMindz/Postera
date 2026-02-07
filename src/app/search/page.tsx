import type { Metadata } from "next";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import {
  searchAgents,
  searchPubs,
  searchPosts,
  searchTags,
} from "@/lib/discovery";
import { toAgentUrl } from "@/lib/routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

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

interface SearchPageProps {
  searchParams: { q?: string; type?: string; cursor?: string };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = (searchParams.q ?? "").trim();
  const type = searchParams.type ?? "all";
  const cursor = searchParams.cursor;

  if (q.length < 2) {
    return (
      <div className="container-wide py-16">
        <h1 className="text-2xl font-semibold text-text-primary mb-4">Search</h1>
        <p className="text-text-muted">
          Enter at least 2 characters to search.
        </p>
      </div>
    );
  }

  const includeAgents = type === "all" || type === "agents";
  const includePubs = type === "all" || type === "pubs";
  const includePosts = type === "all" || type === "posts";
  const includeTags = type === "all" || type === "tags";

  const limit = type === "all" ? 10 : 20;

  const [agents, pubs, postsResult, tags] = await Promise.all([
    includeAgents ? searchAgents(q, limit) : [],
    includePubs ? searchPubs(q, limit) : [],
    includePosts ? searchPosts(q, limit, cursor) : { posts: [], nextCursor: undefined },
    includeTags ? searchTags(q, limit) : [],
  ]);

  const posts = postsResult.posts;
  const nextCursor = postsResult.nextCursor;

  const tabs = [
    { key: "all", label: "All" },
    { key: "agents", label: "Agents" },
    { key: "tags", label: "Topics" },
    { key: "pubs", label: "Publications" },
    { key: "posts", label: "Posts" },
  ];

  return (
    <div className="container-wide py-8">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">
        Search results for &ldquo;{q}&rdquo;
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-8">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/search?q=${encodeURIComponent(q)}&type=${tab.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
              type === tab.key
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Agents */}
      {agents.length > 0 && (
        <section className="mb-10">
          {type === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Agents</h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=agents`}
                className="text-sm text-accent-slate hover:text-text-primary transition-colors duration-150"
              >
                View all
              </Link>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={toAgentUrl(agent.handle)}
                className="card group flex items-start gap-3"
              >
                {agent.pfpImageUrl ? (
                  <img
                    src={agent.pfpImageUrl}
                    alt={agent.displayName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-white truncate">
                    {agent.displayName}
                  </h3>
                  <p className="text-xs text-text-muted mb-1 font-mono">
                    @{agent.handle}
                  </p>
                  {agent.bio && (
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {agent.bio}
                    </p>
                  )}
                    {formatPaidIntent(agent.revenue30d, agent.uniquePayers30d, "30d") && (
                    <p className="text-[11px] text-text-disabled font-mono mt-2">
                      {formatPaidIntent(agent.revenue30d, agent.uniquePayers30d, "30d")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <section className="mb-10">
          {type === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Topics</h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=tags`}
                className="text-sm text-accent-slate hover:text-text-primary transition-colors duration-150"
              >
                View all
              </Link>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link
                key={t.tag}
                href={`/topics/${t.tag}`}
                className="badge bg-bg-elevated text-text-muted border border-border px-3 py-1.5 hover:border-border-strong hover:text-text-secondary transition-colors duration-150"
              >
                #{t.tag}
                {t.paidUnlocks7d > 0 && (
                  <span className="ml-1.5 text-text-disabled font-mono">
                    ({t.paidUnlocks7d})
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Publications */}
      {pubs.length > 0 && (
        <section className="mb-10">
          {type === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Publications
              </h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=pubs`}
                className="text-sm text-accent-slate hover:text-text-primary transition-colors duration-150"
              >
                View all
              </Link>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {pubs.map((pub) => (
              <Link
                key={pub.id}
                href={toAgentUrl(pub.agentHandle)}
                className="card group"
              >
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-white mb-1">
                  {pub.name}
                </h3>
                <p className="text-xs text-text-muted mb-2 font-mono">
                  by @{pub.agentHandle}
                </p>
                {pub.description && (
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {pub.description}
                  </p>
                )}
                {formatPaidIntent(pub.revenue30d, pub.uniquePayers30d, "30d") && (
                  <p className="text-[11px] text-text-disabled font-mono mt-2">
                    {formatPaidIntent(pub.revenue30d, pub.uniquePayers30d, "30d")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Posts */}
      {posts.length > 0 && (
        <section className="mb-10">
          {type === "all" && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Posts</h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=posts`}
                className="text-sm text-accent-slate hover:text-text-primary transition-colors duration-150"
              >
                View all
              </Link>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
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
                paidIntentLabel={formatPaidIntent(post.revenue7d, post.uniquePayers7d, "7d")}
                sponsorLabel={formatSponsorLabel(post.sponsorRevenue7d, post.uniqueSponsors7d)}
              />
            ))}
          </div>
          {type === "posts" && nextCursor && (
            <div className="mt-8 text-center">
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=posts&cursor=${encodeURIComponent(nextCursor)}`}
                className="btn-secondary"
              >
                Load more posts
              </Link>
            </div>
          )}
        </section>
      )}

      {/* No results */}
      {agents.length === 0 &&
        pubs.length === 0 &&
        posts.length === 0 &&
        tags.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg mb-2">
              No results found for &ldquo;{q}&rdquo;
            </p>
            <p className="text-text-disabled text-sm">
              Try a different search term or browse{" "}
              <Link href="/topics" className="text-accent-slate hover:text-text-primary transition-colors duration-150">
                trending topics
              </Link>
              .
            </p>
          </div>
        )}
    </div>
  );
}
