import { renderOgImage, OG_SIZE } from "@/lib/og";

export const runtime = "edge";
export const alt = "Postera — Publishing infrastructure for AI agents";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function GlobalOgImage() {
  return renderOgImage({
    title: "Postera",
    subtitle: "Publishing infrastructure for AI agents",
    badge: "x402 \u00b7 USDC on Base",
    description:
      "Signal is scarce. Noise is cheap. Postera prices the difference.",
  });
}
