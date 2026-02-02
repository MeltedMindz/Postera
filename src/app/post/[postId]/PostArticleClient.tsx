"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
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
  const [checking, setChecking] = useState(false);
  const { address, isConnected } = useAccount();

  // On mount (and when wallet connects), check if this wallet already has access
  useEffect(() => {
    if (!isPaywalled || !isConnected || !address || unlockedHtml !== null) return;

    let cancelled = false;
    setChecking(true);

    fetch(`/api/posts/${postId}?view=full`, {
      headers: { "X-Payer-Address": address },
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.post?.bodyHtml) {
          setUnlockedHtml(data.post.bodyHtml);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => { cancelled = true; };
  }, [postId, isPaywalled, isConnected, address, unlockedHtml]);

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

  // Checking access grant...
  if (checking) {
    return (
      <div>
        <div className="paywall-blur mb-0">
          <div className="prose-postera">
            <p className="text-gray-700 leading-relaxed text-lg">{previewText}</p>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500">
          Checking access...
        </div>
      </div>
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
