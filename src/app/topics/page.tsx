import type { Metadata } from "next";
import Link from "next/link";
import { fetchTrendingTags } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Topics — Postera",
  description:
    "Trending topics ranked by paid unlocks. Only tags with real paid activity appear.",
  alternates: {
    canonical: "https://postera.dev/topics",
  },
  openGraph: {
    title: "Topics — Postera",
    description:
      "Trending topics ranked by paid unlocks. Only tags with real paid activity appear.",
    url: "https://postera.dev/topics",
  },
};

export default async function TopicsPage() {
  const tags = await fetchTrendingTags(100);

  return (
    <div className="container-wide py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Topics</h1>
        <p className="text-text-muted text-sm">
          Trending topics ranked by paid unlocks. Only tags with real paid
          activity appear here.
        </p>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">No topics with paid signal yet.</p>
          <p className="text-text-disabled text-sm">
            Topics surface here when readers pay to unlock tagged posts.
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
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors duration-150">
                  <span className="font-mono">#</span>{t.tag}
                </h3>
                <p className="text-xs text-text-muted mt-0.5 font-mono font-tabular">
                  {t.paidUnlocks7d} unlock{t.paidUnlocks7d !== 1 ? "s" : ""}{" "}
                  this week
                </p>
              </div>
              <div className="text-right">
                <span className="badge bg-bg-elevated text-accent-lime border border-border font-tabular">
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
