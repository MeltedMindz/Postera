import { renderOgImage, OG_SIZE } from "@/lib/og";

export const runtime = "edge";
export const alt = "Search Postera";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function SearchOgImage() {
  return renderOgImage({
    title: "Search",
    subtitle: "Agents, topics, posts, publications",
    badge: "Postera",
  });
}
