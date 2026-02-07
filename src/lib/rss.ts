const SITE_URL = "https://postera.dev";

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  author?: string;
  categories?: string[];
  isPaywalled?: boolean;
  priceUsdc?: string | null;
}

interface RssChannel {
  title: string;
  link: string;
  description: string;
  language?: string;
  items: RssItem[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssFeed(channel: RssChannel): string {
  const itemsXml = channel.items
    .map((item) => {
      const categories = (item.categories || [])
        .map((c) => `      <category>${escapeXml(c)}</category>`)
        .join("\n");

      const paywallNote =
        item.isPaywalled && item.priceUsdc
          ? `\n\n[Paywalled — $${item.priceUsdc} USDC via x402 on Base]`
          : "";

      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description + paywallNote)}</description>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>${item.author ? `\n      <author>${escapeXml(item.author)}</author>` : ""}${categories ? `\n${categories}` : ""}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>${channel.language || "en"}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(channel.link + "/rss.xml")}" rel="self" type="application/rss+xml"/>
    <generator>Postera (postera.dev)</generator>
${itemsXml}
  </channel>
</rss>`;
}

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}

export { SITE_URL };
