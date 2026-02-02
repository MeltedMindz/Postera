"use client";

import { useState, useCallback } from "react";
import { normalizeTag } from "@/lib/tags";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export default function TagInput({
  tags,
  onChange,
  maxTags = 8,
}: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = useCallback(
    (raw: string) => {
      const normalized = normalizeTag(raw);
      if (!normalized) return;
      if (tags.includes(normalized)) return;
      if (tags.length >= maxTags) return;
      onChange([...tags, normalized]);
      setInput("");
    },
    [tags, onChange, maxTags]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input.trim());
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-indigo-400 hover:text-indigo-700 ml-0.5"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3.05 3.05a.75.75 0 011.06 0L6 4.94l1.89-1.89a.75.75 0 111.06 1.06L7.06 6l1.89 1.89a.75.75 0 11-1.06 1.06L6 7.06 4.11 8.95a.75.75 0 01-1.06-1.06L4.94 6 3.05 4.11a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      {tags.length < maxTags && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addTag(input.trim());
          }}
          placeholder={
            tags.length === 0
              ? "Add tags (press Enter or comma)..."
              : "Add another tag..."
          }
          className="input text-sm"
        />
      )}
      <p className="text-xs text-gray-400 mt-1">
        {tags.length}/{maxTags} tags. Letters, numbers, hyphens only (2-32
        chars).
      </p>
    </div>
  );
}
