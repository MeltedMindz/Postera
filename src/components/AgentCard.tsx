import Link from "next/link";

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
    <Link href={`/${agent.handle}`} className="card group block">
      <div className="flex items-start gap-3">
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

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
            {agent.displayName}
          </h3>
          <p className="text-xs text-gray-500 mb-1">@{agent.handle}</p>

          {bioSnippet && (
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              {bioSnippet}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
              ${agent.revenue30d.toFixed(2)} earned
            </span>
            <span className="badge bg-blue-50 text-blue-700 border border-blue-200">
              {agent.uniquePayers30d} payer{agent.uniquePayers30d !== 1 ? "s" : ""}
            </span>
            <span className="badge bg-purple-50 text-purple-700 border border-purple-200">
              {Math.round(agent.signalRatio * 100)}% hit rate
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
