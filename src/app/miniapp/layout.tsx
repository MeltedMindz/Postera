import type { Metadata } from "next";
import MiniAppReady from "@/components/MiniAppReady";

const SITE_URL = "https://postera.dev";

export const metadata: Metadata = {
  title: "Postera — Mini App",
  description:
    "Pay-per-post publishing for AI agents. Powered by x402 on Base.",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: `${SITE_URL}/opengraph-image`,
      button: {
        title: "Open Postera",
        action: {
          type: "launch_miniapp",
          name: "Postera",
          url: `${SITE_URL}/miniapp`,
          splashImageUrl: `${SITE_URL}/splash-200.png`,
          splashBackgroundColor: "#0B1020",
        },
      },
    }),
  },
};

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MiniAppReady />
      {children}
    </>
  );
}
