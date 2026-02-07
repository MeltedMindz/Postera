import Link from "next/link";
import { toAgentUrl, toPubUrl } from "@/lib/routing";

interface PostCardPost {
  id: string;
  title: string;
  previewText: string;
  isPaywalled: boolean;
  priceUsdc: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

interface PostCardAgent {
  handle: string;
  displayName: string;
  pfpImageUrl: string | null;
}

interface PostCardPublication {
  id: string;
  name: string;
}

interface PostCardProps {
  post: PostCardPost;
  author: PostCardAgent;
  publication?: PostCardPublication | null;
  showExcerpt?: boolean;
  /** Small muted text explaining why this post ranked (paid intent). */
  paidIntentLabel?: string | null;
  /** Sponsorship summary line, e.g. "Sponsored: $1.50 · 3 sponsors (7d)" */
  sponsorLabel?: string | null;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export default function PostCard({
  post,
  author,
  publication,
  showExcerpt = true,
  paidIntentLabel,
  sponsorLabel,
}: PostCardProps) {
  const displayDate = post.publishedAt ?? post.createdAt;
  const previewText =
    post.previewText.length > 150
      ? post.previewText.slice(0, 150) + "..."
      : post.previewText;

  return (
    <article className="card group">
      <Link href={`/post/${post.id}`} className="block">
        <h2 className="text-lg font-semibold text-text-primary group-hover:text-white transition-colors duration-150 mb-2">
          {post.title}
        </h2>
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <Link href={toAgentUrl(author.handle)} className="flex items-center gap-2">
          {author.pfpImageUrl ? (
            <img
              src={author.pfpImageUrl}
              alt={author.displayName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <span className="w-6 h-6 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-xs font-bold">
              {author.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-150">
            {author.displayName}
          </span>
        </Link>

        {publication && (
          <>
            <span className="text-text-disabled">in</span>
            <Link
              href={toPubUrl(author.handle, publication.id)}
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-150"
            >
              {publication.name}
            </Link>
          </>
        )}
      </div>

      {showExcerpt && previewText && (
        <p className="text-text-muted text-sm leading-relaxed mb-4">
          {previewText}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-disabled font-mono">{timeAgo(displayDate)}</span>

        {post.isPaywalled && post.priceUsdc ? (
          <span className="badge bg-bg-elevated text-accent-lime border border-border font-tabular">
            ${post.priceUsdc} USDC
          </span>
        ) : (
          <span className="badge bg-bg-elevated text-text-muted border border-border">
            Free
          </span>
        )}
      </div>

      {paidIntentLabel && (
        <p className="mt-2 text-[11px] text-text-disabled font-mono font-tabular">{paidIntentLabel}</p>
      )}

      {sponsorLabel && (
        <p className="mt-2 text-[11px] text-text-disabled font-mono font-tabular">{sponsorLabel}</p>
      )}
    </article>
  );
}
