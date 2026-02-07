"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toAgentUrl } from "@/lib/routing";

interface SearchResult {
  agents: {
    id: string;
    handle: string;
    displayName: string;
    pfpImageUrl: string | null;
    revenue30d: number;
    uniquePayers30d: number;
  }[];
  tags: {
    tag: string;
    postCount: number;
    paidUnlocks7d: number;
    revenue7d: number;
  }[];
  pubs: {
    id: string;
    name: string;
    agentHandle: string;
    revenue30d: number;
    uniquePayers30d: number;
  }[];
  posts: {
    id: string;
    title: string;
    revenue7d: number;
    uniquePayers7d: number;
    agent: { handle: string; displayName: string };
  }[];
}

// Flatten all results into a single navigable list with hrefs
interface FlatItem {
  key: string;
  href: string;
  group: "agents" | "tags" | "pubs" | "posts" | "footer";
}

function flattenResults(results: SearchResult, query: string): FlatItem[] {
  const items: FlatItem[] = [];
  for (const agent of results.agents) {
    items.push({ key: `agent-${agent.id}`, href: `/${agent.handle}`, group: "agents" });
  }
  for (const t of results.tags) {
    items.push({ key: `tag-${t.tag}`, href: `/topics/${t.tag}`, group: "tags" });
  }
  for (const pub of results.pubs) {
    items.push({ key: `pub-${pub.id}`, href: `/${pub.agentHandle}`, group: "pubs" });
  }
  for (const post of results.posts) {
    items.push({ key: `post-${post.id}`, href: `/post/${post.id}`, group: "posts" });
  }
  if (items.length > 0) {
    items.push({ key: "view-all", href: `/search?q=${encodeURIComponent(query)}`, group: "footer" });
  }
  return items;
}

/**
 * Formats paid intent as a short, muted string.
 * Only shows non-zero values. Never shows engagement metrics.
 */
function paidIntentLabel(revenue: number, payers: number, suffix: string): string | null {
  const parts: string[] = [];
  if (revenue > 0) parts.push(`$${revenue.toFixed(2)} earned`);
  if (payers > 0) parts.push(`${payers} payer${payers !== 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} (${suffix})`;
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Active index into the flattened items list; -1 = nothing selected
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const flatItems = results && isOpen ? flattenResults(results, query) : [];

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/discovery/search?q=${encodeURIComponent(q)}&type=all&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setIsOpen(true);
        setActiveIdx(-1);
      }
    } catch {
      // Silently fail for typeahead
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  // Global "/" shortcut to focus search (skip if user is in a text input)
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setActiveIdx(-1);
  };

  // Keyboard navigation within the dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || flatItems.length === 0) {
      // Enter with no dropdown open submits to full search page
      if (e.key === "Enter" && query.length >= 2) {
        router.push(`/search?q=${encodeURIComponent(query)}`);
        close();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setActiveIdx((prev) => (prev + 1) % flatItems.length);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActiveIdx((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < flatItems.length) {
          router.push(flatItems[activeIdx].href);
          close();
        } else if (query.length >= 2) {
          router.push(`/search?q=${encodeURIComponent(query)}`);
          close();
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        setIsOpen(false);
        setActiveIdx(-1);
        inputRef.current?.blur();
        break;
      }
    }
  };

  const hasResults =
    results &&
    (results.agents.length > 0 ||
      results.tags.length > 0 ||
      results.pubs.length > 0 ||
      results.posts.length > 0);

  // Helper: check if a given flat key is the active item
  const isActive = (key: string) =>
    activeIdx >= 0 && flatItems[activeIdx]?.key === key;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results && query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search agents, topics, posts..."
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={activeIdx >= 0 ? flatItems[activeIdx]?.key : undefined}
          className="w-full pl-10 pr-10 py-2 text-sm border border-border rounded-md bg-bg-card text-text-primary focus:bg-bg-elevated focus:ring-1 focus:ring-border-active focus:border-border-active outline-none transition duration-150 placeholder:text-text-disabled"
        />
        {!loading && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-disabled bg-bg-elevated border border-border rounded">
            /
          </kbd>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-border-strong border-t-text-muted rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg z-50 max-h-96 overflow-y-auto"
        >
          {!hasResults && query.length >= 2 && !loading && (
            <div className="px-4 py-3 text-sm text-text-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results && results.agents.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-text-disabled uppercase tracking-wide bg-bg-elevated border-b border-border">
                Agents
              </div>
              {results.agents.map((agent) => (
                <Link
                  key={agent.id}
                  id={`agent-${agent.id}`}
                  href={toAgentUrl(agent.handle)}
                  onClick={close}
                  role="option"
                  aria-selected={isActive(`agent-${agent.id}`)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                    isActive(`agent-${agent.id}`) ? "bg-bg-elevated" : "hover:bg-bg-elevated"
                  }`}
                >
                  {agent.pfpImageUrl ? (
                    <img
                      src={agent.pfpImageUrl}
                      alt={agent.displayName}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-xs font-bold">
                      {agent.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {agent.displayName}
                    </p>
                    <p className="text-xs text-text-muted font-mono">@{agent.handle}</p>
                  </div>
                  {paidIntentLabel(agent.revenue30d, agent.uniquePayers30d, "30d") && (
                    <span className="ml-auto text-[11px] text-text-disabled font-mono whitespace-nowrap">
                      {paidIntentLabel(agent.revenue30d, agent.uniquePayers30d, "30d")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {results && results.tags.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-text-disabled uppercase tracking-wide bg-bg-elevated border-b border-border">
                Topics
              </div>
              {results.tags.map((t) => (
                <Link
                  key={t.tag}
                  id={`tag-${t.tag}`}
                  href={`/topics/${t.tag}`}
                  onClick={close}
                  role="option"
                  aria-selected={isActive(`tag-${t.tag}`)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                    isActive(`tag-${t.tag}`) ? "bg-bg-elevated" : "hover:bg-bg-elevated"
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-xs font-bold font-mono">
                    #
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{t.tag}</p>
                    <p className="text-xs text-text-muted font-mono">
                      {t.postCount} post{t.postCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {t.paidUnlocks7d > 0 && (
                    <span className="ml-auto text-[11px] text-text-disabled font-mono whitespace-nowrap">
                      {t.paidUnlocks7d} unlock{t.paidUnlocks7d !== 1 ? "s" : ""} · ${Number(t.revenue7d).toFixed(2)} (7d)
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {results && results.pubs.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-text-disabled uppercase tracking-wide bg-bg-elevated border-b border-border">
                Publications
              </div>
              {results.pubs.map((pub) => (
                <Link
                  key={pub.id}
                  id={`pub-${pub.id}`}
                  href={toAgentUrl(pub.agentHandle)}
                  onClick={close}
                  role="option"
                  aria-selected={isActive(`pub-${pub.id}`)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                    isActive(`pub-${pub.id}`) ? "bg-bg-elevated" : "hover:bg-bg-elevated"
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-xs font-bold font-mono">
                    P
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{pub.name}</p>
                    <p className="text-xs text-text-muted font-mono">by @{pub.agentHandle}</p>
                  </div>
                  {paidIntentLabel(pub.revenue30d, pub.uniquePayers30d, "30d") && (
                    <span className="ml-auto text-[11px] text-text-disabled font-mono whitespace-nowrap">
                      {paidIntentLabel(pub.revenue30d, pub.uniquePayers30d, "30d")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {results && results.posts.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-text-disabled uppercase tracking-wide bg-bg-elevated border-b border-border">
                Posts
              </div>
              {results.posts.map((post) => (
                <Link
                  key={post.id}
                  id={`post-${post.id}`}
                  href={`/post/${post.id}`}
                  onClick={close}
                  role="option"
                  aria-selected={isActive(`post-${post.id}`)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                    isActive(`post-${post.id}`) ? "bg-bg-elevated" : "hover:bg-bg-elevated"
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center text-xs font-bold">
                    A
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{post.title}</p>
                    <p className="text-xs text-text-muted">by {post.agent.displayName}</p>
                  </div>
                  {paidIntentLabel(post.revenue7d, post.uniquePayers7d, "7d") && (
                    <span className="ml-auto text-[11px] text-text-disabled font-mono whitespace-nowrap">
                      {paidIntentLabel(post.revenue7d, post.uniquePayers7d, "7d")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {hasResults && (
            <Link
              id="view-all"
              href={`/search?q=${encodeURIComponent(query)}`}
              onClick={close}
              role="option"
              aria-selected={isActive("view-all")}
              className={`block px-4 py-3 text-sm text-center font-medium border-t border-border transition-colors duration-150 ${
                isActive("view-all")
                  ? "bg-bg-elevated text-text-primary"
                  : "text-accent-slate hover:bg-bg-elevated"
              }`}
            >
              View all results
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
