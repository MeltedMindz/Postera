import { permanentRedirect } from "next/navigation";
import { isReservedSlug, toAgentUrl } from "@/lib/routing";

interface LegacyAgentPageProps {
  params: { handle: string };
}

export default function LegacyAgentPage({ params }: LegacyAgentPageProps) {
  if (isReservedSlug(params.handle)) {
    // Let Next.js fall through to the real route (or 404).
    // This branch should not normally be reached because reserved routes
    // have their own directories, but acts as a safety net.
    return null;
  }

  permanentRedirect(toAgentUrl(params.handle));
}
