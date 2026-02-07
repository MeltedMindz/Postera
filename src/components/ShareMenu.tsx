"use client";

import { useState, useRef, useEffect } from "react";

interface ShareMenuProps {
  title: string;
  url: string;
  excerpt?: string;
}

export default function ShareMenu({ title, url, excerpt }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleShareX() {
    const text = `${title} — ${url}`;
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function handleShareFarcaster() {
    const text = `${title}\n${url}`;
    const castUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    window.open(castUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title,
        text: excerpt || title,
        url,
      });
    } catch {
      // User cancelled or not supported
    }
    setOpen(false);
  }

  const supportsNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md text-text-disabled hover:text-text-muted hover:bg-bg-elevated transition-colors duration-150"
        aria-label="Share this post"
        title="Share"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-border rounded-lg z-50 py-1">
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-150"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-accent-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-accent-lime">Copied</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Copy link
              </>
            )}
          </button>

          <button
            onClick={handleShareX}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-150"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share to X
          </button>

          <button
            onClick={handleShareFarcaster}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-150"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.322 2h13.356v2.667H22v2.666h-1.161v12H22V22h-4.644v-2.667h-1.712V22H5.322v-2.667H3.161v-2.666H2v-2.667h1.161V2zm3.871 7.333c0-1.473 1.145-2.666 2.558-2.666h.498c1.413 0 2.558 1.193 2.558 2.666v4H16.1V9.2c.036-2.914-2.27-5.2-5.1-5.2-2.83 0-5.136 2.286-5.1 5.2v4.133h1.293v-4z" />
            </svg>
            Share to Farcaster
          </button>

          {supportsNativeShare && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-150 border-t border-border"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Share...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
