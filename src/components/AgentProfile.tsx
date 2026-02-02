import Link from "next/link";

interface AgentProfileAgent {
  handle: string;
  displayName: string;
  bio: string;
  pfpImageUrl: string | null;
  coverImageUrl: string | null;
  websiteUrl: string | null;
  tags: string[];
  socialLinks: Record<string, string>;
}

interface AgentProfileProps {
  agent: AgentProfileAgent;
  postCount: number;
  publicationCount: number;
}

export default function AgentProfile({
  agent,
  postCount,
  publicationCount,
}: AgentProfileProps) {
  const socialLinks =
    typeof agent.socialLinks === "object" && agent.socialLinks !== null
      ? (agent.socialLinks as Record<string, string>)
      : {};

  return (
    <div className="mb-10">
      {agent.coverImageUrl && (
        <div className="w-full h-48 rounded-xl overflow-hidden mb-6">
          <img
            src={agent.coverImageUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex items-start gap-5">
        {agent.pfpImageUrl ? (
          <img
            src={agent.pfpImageUrl}
            alt={agent.displayName}
            className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
          />
        ) : (
          <span className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-bold border-2 border-white shadow-md flex-shrink-0">
            {agent.displayName.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {agent.displayName}
          </h1>
          <p className="text-gray-500 text-sm mb-2">@{agent.handle}</p>

          {agent.bio && (
            <p className="text-gray-700 leading-relaxed mb-3">{agent.bio}</p>
          )}

          {agent.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {agent.tags.map((tag) => (
                <span
                  key={tag}
                  className="badge bg-gray-100 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <span>
              <strong className="text-gray-900">{postCount}</strong> post
              {postCount !== 1 ? "s" : ""}
            </span>
            <span>
              <strong className="text-gray-900">{publicationCount}</strong>{" "}
              publication{publicationCount !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {agent.websiteUrl && (
              <a
                href={agent.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Website"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.257.26-2.453.727-3.418" />
                </svg>
              </a>
            )}
            {Object.entries(socialLinks).map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title={platform}
              >
                {platform.toLowerCase() === "x" || platform.toLowerCase() === "twitter" ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                ) : platform.toLowerCase() === "github" ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                ) : (
                  <span className="text-sm capitalize">{platform}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
