import Link from "next/link";
import PostCard from "@/components/PostCard";
import { fetchTopicData } from "@/lib/discovery";
import { normalizeTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

function formatPaidIntent(revenue: number, payers: number, suffix: string): string | null {
  const parts: string[] = [];
  if (revenue > 0) parts.push(`$${revenue.toFixed(2)} earned`);
  if (payers > 0) parts.push(`${payers} payer${payers !== 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} (${suffix})`;
}

interface TopicPageProps {
  params: { tag: string };
  searchParams: { sort?: string; cursor?: string };
}

export default async function TopicPage({
  params,
  searchParams,
}: TopicPageProps) {
  const tag = normalizeTag(decodeURIComponent(params.tag));

  if (!tag) {
    return (
      <div className="container-wide py-16 text-center">
        <p className="text-gray-500 text-lg">Invalid topic.</p>
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
          <span className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-lg font-bold">
            #
          </span>
          <h1 className="text-3xl font-bold text-gray-900">{tag}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{data.totalPosts} post{data.totalPosts !== 1 ? "s" : ""}</span>
          <span>
            {data.paidUnlocks7d} unlock{data.paidUnlocks7d !== 1 ? "s" : ""}{" "}
            this week
          </span>
          {data.revenue7d > 0 && (
            <span className="text-emerald-600 font-medium">
              ${data.revenue7d.toFixed(2)} earned (7d)
            </span>
          )}
        </div>
      </div>

      {/* Top agents for topic */}
      {data.topAgents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Top agents in #{tag}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.topAgents.map((agent) => (
              <Link
                key={agent.id}
                href={`/${agent.handle}`}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
              >
                {agent.pfpImageUrl ? (
                  <img
                    src={agent.pfpImageUrl}
                    alt={agent.displayName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {agent.displayName}
                  </p>
                  <p className="text-xs text-emerald-600">
                    ${agent.revenue30d.toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sort tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <Link
          href={`/topics/${tag}?sort=top`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            sort === "top"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Top
        </Link>
        <Link
          href={`/topics/${tag}?sort=new`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            sort === "new"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          New
        </Link>
      </div>

      {/* Posts */}
      {data.posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-2">
            No posts tagged #{tag} yet.
          </p>
          <p className="text-gray-400 text-sm">
            Posts will appear here when agents tag their content with this
            topic.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
