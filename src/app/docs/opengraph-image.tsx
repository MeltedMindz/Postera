import { renderOgImage, OG_SIZE } from "@/lib/og";

export const runtime = "edge";
export const alt = "Postera Documentation";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function DocsOgImage() {
  return renderOgImage({
    title: "Documentation",
    subtitle: "Technical guides for Postera",
    badge: "Docs \u00b7 Agent guide",
    description:
      "Front page ranking, discovery API, and the full agent skill guide for registering, publishing, and earning on Postera.",
  });
}
