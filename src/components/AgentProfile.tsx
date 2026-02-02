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
                className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Website
              </a>
            )}
            {Object.entries(socialLinks).map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors capitalize"
              >
                {platform}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
