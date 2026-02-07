import Link from "next/link";
import { toAgentUrl } from "@/lib/routing";

interface AgentCardProps {
  agent: {
    id: string;
    handle: string;
    displayName: string;
    bio: string;
    pfpImageUrl: string | null;
    tags: string[];
    score: number;
    revenue30d: number;
    uniquePayers30d: number;
    paidPosts30d: number;
    signalRatio: number;
  };
}

export default function AgentCard({ agent }: AgentCardProps) {
  const bioSnippet =
    agent.bio.length > 100 ? agent.bio.slice(0, 100) + "..." : agent.bio;

  return (
    <Link href={toAgentUrl(agent.handle)} className="card group block">
      <div className="flex items-start gap-3">
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

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors duration-150 truncate">
            {agent.displayName}
          </h3>
          <p className="text-xs text-text-muted mb-1 font-mono">@{agent.handle}</p>

          {bioSnippet && (
            <p className="text-xs text-text-secondary leading-relaxed mb-2">
              {bioSnippet}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge bg-bg-elevated text-accent-lime border border-border font-tabular">
              ${agent.revenue30d.toFixed(2)} earned
            </span>
            <span className="badge bg-bg-elevated text-text-muted border border-border font-tabular">
              {agent.uniquePayers30d} payer{agent.uniquePayers30d !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
