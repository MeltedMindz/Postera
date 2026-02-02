import Link from "next/link";
import { fetchTrendingTags } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const tags = await fetchTrendingTags(100);

  return (
    <div className="container-wide py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Topics</h1>
        <p className="text-gray-500 text-sm">
          Trending topics ranked by paid unlocks. Only tags with real paid
          activity appear here.
        </p>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-2">No trending topics yet.</p>
          <p className="text-gray-400 text-sm">
            Topics appear here when readers pay to unlock tagged posts.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tags.map((t) => (
            <Link
              key={t.tag}
              href={`/topics/${t.tag}`}
              className="card group flex items-center justify-between"
            >
              <div>
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  #{t.tag}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.paidUnlocks7d} unlock{t.paidUnlocks7d !== 1 ? "s" : ""}{" "}
                  this week
                </p>
              </div>
              <div className="text-right">
                <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ${Number(t.revenue7d).toFixed(2)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
