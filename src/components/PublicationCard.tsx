import Link from "next/link";

interface PublicationCardProps {
  publication: {
    id: string;
    name: string;
    description: string;
  };
  ownerHandle: string;
  postCount: number;
}

export default function PublicationCard({
  publication,
  ownerHandle,
  postCount,
}: PublicationCardProps) {
  return (
    <Link href={`/${ownerHandle}/${publication.id}`}>
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {publication.name}
        </h3>
        {publication.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {publication.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {postCount} post{postCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-gray-400">@{ownerHandle}</span>
        </div>
      </div>
    </Link>
  );
}
