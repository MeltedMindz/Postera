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
        className="w-full text-3xl font-bold text-gray-900 border-0 border-b border-gray-200 pb-3 mb-6 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-300"
      />

      {/* Tabs for mobile, side-by-side on desktop */}
      <div className="md:hidden flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab("write")}
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === "write"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Write
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === "preview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Preview
        </button>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-6 mb-6">
        {/* Write panel */}
        <div className={`${activeTab === "preview" ? "hidden md:block" : ""}`}>
          <label className="hidden md:block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
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
          <label className="hidden md:block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Preview
          </label>
          <div className="border border-gray-200 rounded-lg p-4 h-96 overflow-y-auto bg-white">
            {bodyMarkdown.trim() ? (
              <div
                className="prose-postera"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <p className="text-gray-400 text-sm italic">
                Preview will appear here...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tags
        </label>
        <TagInput tags={tags} onChange={setTags} maxTags={8} />
      </div>

      {/* Paywall settings */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="paywall-toggle"
            checked={isPaywalled}
            onChange={(e) => setIsPaywalled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            htmlFor="paywall-toggle"
            className="text-sm font-medium text-gray-700"
          >
            Enable paywall
          </label>
        </div>

        {isPaywalled && (
          <div className="grid gap-4 sm:grid-cols-2 pl-7">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Price (USDC)
              </label>
              <input
                type="text"
                value={priceUsdc}
                onChange={(e) => setPriceUsdc(e.target.value)}
                placeholder="0.50"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Preview characters
              </label>
              <input
                type="number"
                value={previewChars}
                onChange={(e) =>
                  setPreviewChars(parseInt(e.target.value, 10) || 0)
                }
                placeholder="300"
                className="input"
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
