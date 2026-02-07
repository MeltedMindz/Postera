"use client";

import { useState, useCallback } from "react";
import { marked } from "marked";
import TagInput from "@/components/TagInput";

interface EditorProps {
  initialTitle?: string;
  initialBody?: string;
  initialIsPaywalled?: boolean;
  initialPriceUsdc?: string;
  initialPreviewChars?: number;
  initialTags?: string[];
  onSaveDraft?: (data: EditorData) => Promise<void>;
  onPublish?: (data: EditorData) => Promise<void>;
}

export interface EditorData {
  title: string;
  bodyMarkdown: string;
  isPaywalled: boolean;
  priceUsdc: string;
  previewChars: number;
  tags: string[];
}

export default function Editor({
  initialTitle = "",
  initialBody = "",
  initialIsPaywalled = false,
  initialPriceUsdc = "0.50",
  initialPreviewChars = 300,
  initialTags = [],
  onSaveDraft,
  onPublish,
}: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [bodyMarkdown, setBodyMarkdown] = useState(initialBody);
  const [isPaywalled, setIsPaywalled] = useState(initialIsPaywalled);
  const [priceUsdc, setPriceUsdc] = useState(initialPriceUsdc);
  const [previewChars, setPreviewChars] = useState(initialPreviewChars);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const getEditorData = useCallback((): EditorData => {
    return {
      title,
      bodyMarkdown,
      isPaywalled,
      priceUsdc: isPaywalled ? priceUsdc : "0",
      previewChars: isPaywalled ? previewChars : 0,
      tags,
    };
  }, [title, bodyMarkdown, isPaywalled, priceUsdc, previewChars, tags]);

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    setSaving(true);
    try {
      await onSaveDraft(getEditorData());
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    setPublishing(true);
    try {
      await onPublish(getEditorData());
    } finally {
      setPublishing(false);
    }
  };

  const renderedHtml = (() => {
    try {
      return marked.parse(bodyMarkdown, { async: false }) as string;
    } catch {
      return "<p>Error rendering preview.</p>";
    }
  })();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title..."
        className="w-full text-3xl font-bold text-text-primary bg-transparent border-0 border-b border-border pb-3 mb-6 focus:outline-none focus:border-border-active transition-colors duration-150 placeholder:text-text-disabled"
      />

      {/* Tabs for mobile, side-by-side on desktop */}
      <div className="md:hidden flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab("write")}
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors duration-150 ${
            activeTab === "write"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          Write
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors duration-150 ${
            activeTab === "preview"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          Preview
        </button>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-6 mb-6">
        {/* Write panel */}
        <div className={`${activeTab === "preview" ? "hidden md:block" : ""}`}>
          <label className="hidden md:block text-xs font-medium text-text-disabled uppercase tracking-widest mb-2 font-mono">
            Markdown
          </label>
          <textarea
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            placeholder="Write your post in Markdown..."
            className="input h-96 resize-y font-mono text-sm leading-relaxed"
          />
        </div>

        {/* Preview panel */}
        <div className={`${activeTab === "write" ? "hidden md:block" : ""}`}>
          <label className="hidden md:block text-xs font-medium text-text-disabled uppercase tracking-widest mb-2 font-mono">
            Preview
          </label>
          <div className="border border-border rounded-lg p-4 h-96 overflow-y-auto bg-bg-card">
            {bodyMarkdown.trim() ? (
              <div
                className="prose-postera"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <p className="text-text-disabled text-sm italic">
                Preview will appear here...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="border border-border rounded-lg p-5 mb-6 bg-bg-card">
        <label className="block text-sm font-medium text-text-secondary mb-3">
          Tags
        </label>
        <TagInput tags={tags} onChange={setTags} maxTags={8} />
      </div>

      {/* Paywall settings */}
      <div className="border border-border rounded-lg p-5 mb-6 bg-bg-card">
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="paywall-toggle"
            checked={isPaywalled}
            onChange={(e) => setIsPaywalled(e.target.checked)}
            className="w-4 h-4 rounded border-border-strong text-text-primary focus:ring-border-active bg-bg-elevated"
          />
          <label
            htmlFor="paywall-toggle"
            className="text-sm font-medium text-text-secondary"
          >
            Enable paywall
          </label>
        </div>

        {isPaywalled && (
          <div className="grid gap-4 sm:grid-cols-2 pl-7">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1 font-mono">
                Price (USDC)
              </label>
              <input
                type="text"
                value={priceUsdc}
                onChange={(e) => setPriceUsdc(e.target.value)}
                placeholder="0.50"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1 font-mono">
                Preview characters
              </label>
              <input
                type="number"
                value={previewChars}
                onChange={(e) =>
                  setPreviewChars(parseInt(e.target.value, 10) || 0)
                }
                placeholder="300"
                className="input font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={saving || !title.trim()}
          className="btn-secondary"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing || !title.trim() || !bodyMarkdown.trim()}
          className="btn-primary"
        >
          {publishing ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}
