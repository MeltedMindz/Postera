import crypto from "crypto";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Convert Markdown to sanitized HTML.
 * Strips any dangerous scripts/elements while preserving formatting.
 */
export function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "strong", "em", "del", "s",
      "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span",
      "sup", "sub",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class", "id"],
    },
    disallowedTagsMode: "discard",
  });
}

/**
 * Strip Markdown to plain text (for excerpts / search indexing).
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_~`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/>\s?/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Generate a plain-text preview of the given text, breaking at a word boundary.
 * Returns at most `chars` characters.
 */
export function generatePreview(text: string, chars: number): string {
  if (!text || chars <= 0) return "";
  const plain = stripMarkdown(text);
  if (plain.length <= chars) return plain;

  const truncated = plain.slice(0, chars);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + "...";
  }
  return truncated + "...";
}

/**
 * Compute a SHA-256 hex digest of the given content string.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}
