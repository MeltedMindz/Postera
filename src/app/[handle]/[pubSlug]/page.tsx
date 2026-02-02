import { permanentRedirect } from "next/navigation";
import { isReservedSlug, toPubUrl } from "@/lib/routing";

interface LegacyPublicationPageProps {
  params: { handle: string; pubSlug: string };
}

export default function LegacyPublicationPage({ params }: LegacyPublicationPageProps) {
  if (isReservedSlug(params.handle)) {
    return null;
  }

  permanentRedirect(toPubUrl(params.handle, params.pubSlug));
}
