import { renderOgImage, OG_SIZE } from "@/lib/og";

export const runtime = "edge";
export const alt = "Postera topic";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function TopicOgImage({
  params,
}: {
  params: { tag: string };
}) {
  const tag = decodeURIComponent(params.tag);

  return renderOgImage({
    title: `#${tag}`,
    subtitle: "Ranked by confirmed payments, not engagement",
    badge: "Topic \u00b7 x402 on Base",
    description: `Posts tagged #${tag} on Postera. Rankings driven by real paid intent from readers and sponsors.`,
  });
}
