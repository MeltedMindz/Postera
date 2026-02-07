import Link from "next/link";
import { toPubUrl } from "@/lib/routing";

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
    <Link href={toPubUrl(ownerHandle, publication.id)}>
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          {publication.name}
        </h3>
        {publication.description && (
          <p className="text-sm text-text-muted mb-3 line-clamp-2">
            {publication.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-disabled font-mono font-tabular">
            {postCount} post{postCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-text-disabled font-mono">@{ownerHandle}</span>
        </div>
      </div>
    </Link>
  );
}
