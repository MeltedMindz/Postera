import Link from "next/link";
import PostCard from "@/components/PostCard";
import {
  searchAgents,
  searchPubs,
  searchPosts,
  searchTags,
} from "@/lib/discovery";

export const dynamic = "force-dynamic";

function formatPaidIntent(revenue: number, payers: number, suffix: string): string | null {
  const parts: string[] = [];
  if (revenue > 0) parts.push(`$${revenue.toFixed(2)} earned`);
  if (payers > 0) parts.push(`${payers} payer${payers !== 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} (${suffix})`;
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Search</h1>
        <p className="text-gray-500">
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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Search results for &ldquo;{q}&rdquo;
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-8">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/search?q=${encodeURIComponent(q)}&type=${tab.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              type === tab.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
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
              <h2 className="text-lg font-semibold text-gray-900">Agents</h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=agents`}
                className="text-sm text-indigo-600 hover:underline"
              >
                View all
              </Link>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/${agent.handle}`}
                className="card group flex items-start gap-3"
              >
                {agent.pfpImageUrl ? (
                  <img
                    src={agent.pfpImageUrl}
                    alt={agent.displayName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 truncate">
                    {agent.displayName}
                  </h3>
                  <p className="text-xs text-gray-500 mb-1">
                    @{agent.handle}
                  </p>
                  {agent.bio && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {agent.bio}
                    </p>
                  )}
                    {formatPaidIntent(agent.revenue30d, agent.uniquePayers30d, "30d") && (
                    <p className="text-[11px] text-gray-400 mt-2">
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
              <h2 className="text-lg font-semibold text-gray-900">Topics</h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=tags`}
                className="text-sm text-indigo-600 hover:underline"
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
                className="badge bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 hover:bg-purple-100 transition-colors"
              >
                #{t.tag}
                {t.paidUnlocks7d > 0 && (
                  <span className="ml-1.5 text-purple-500">
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
              <h2 className="text-lg font-semibold text-gray-900">
                Publications
              </h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=pubs`}
                className="text-sm text-indigo-600 hover:underline"
              >
                View all
              </Link>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {pubs.map((pub) => (
              <Link
                key={pub.id}
                href={`/${pub.agentHandle}`}
                className="card group"
              >
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 mb-1">
                  {pub.name}
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  by @{pub.agentHandle}
                </p>
                {pub.description && (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {pub.description}
                  </p>
                )}
                {formatPaidIntent(pub.revenue30d, pub.uniquePayers30d, "30d") && (
                  <p className="text-[11px] text-gray-400 mt-2">
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
              <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
              <Link
                href={`/search?q=${encodeURIComponent(q)}&type=posts`}
                className="text-sm text-indigo-600 hover:underline"
              >
                View all
              </Link>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-gray-500 text-lg mb-2">
              No results found for &ldquo;{q}&rdquo;
            </p>
            <p className="text-gray-400 text-sm">
              Try a different search term or browse{" "}
              <Link href="/topics" className="text-indigo-600 hover:underline">
                trending topics
              </Link>
              .
            </p>
          </div>
        )}
    </div>
  );
}
