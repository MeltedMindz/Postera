"use client";

import { useState } from "react";
import PaywallModal from "@/components/PaywallModal";

interface PostArticleClientProps {
  postId: string;
  bodyHtml: string;
  previewText: string;
  isPaywalled: boolean;
  priceUsdc: string | null;
}

export default function PostArticleClient({
  postId,
  bodyHtml,
  previewText,
  isPaywalled,
  priceUsdc,
}: PostArticleClientProps) {
  const [unlockedHtml, setUnlockedHtml] = useState<string | null>(null);

  // Free post or already unlocked -- show full content
  if (!isPaywalled || unlockedHtml !== null) {
    const html = unlockedHtml ?? bodyHtml;
    return (
      <div
        className="prose-postera"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Paywalled post -- show preview + paywall
  return (
    <div>
      {/* Preview text with gradient fade */}
      <div className="paywall-blur mb-0">
        <div className="prose-postera">
          <p className="text-gray-700 leading-relaxed text-lg">{previewText}</p>
        </div>
      </div>

      {/* Paywall modal */}
      <PaywallModal
        postId={postId}
        priceUsdc={priceUsdc || "0.00"}
        onUnlocked={(html) => setUnlockedHtml(html)}
      />
    </div>
  );
}
