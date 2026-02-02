/**
 * Tag normalization for posts and publications.
 *
 * Rules:
 * - Lowercase
 * - Trim whitespace
 * - Collapse internal whitespace
 * - Convert spaces and underscores to hyphens
 * - Strip anything not [a-z0-9-]
 * - Collapse consecutive hyphens
 * - Strip leading/trailing hyphens
 * - Length: 2..32 characters
 * - Max 8 tags per entity
 */

const TAG_MIN_LENGTH = 2;
const TAG_MAX_LENGTH = 32;
const MAX_TAGS_PER_ENTITY = 8;

/**
 * Normalize a single tag string. Returns null if invalid after normalization.
 */
export function normalizeTag(raw: string): string | null {
  let tag = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // collapse whitespace -> hyphen
    .replace(/_/g, "-") // underscores -> hyphen
    .replace(/[^a-z0-9-]/g, "") // strip invalid chars
    .replace(/-{2,}/g, "-") // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens

  if (tag.length < TAG_MIN_LENGTH || tag.length > TAG_MAX_LENGTH) {
    return null;
  }

  return tag;
}

/**
 * Normalize an array of tag strings.
 * - Normalizes each tag
 * - Removes nulls (invalid tags)
 * - Deduplicates
 * - Caps at MAX_TAGS_PER_ENTITY
 */
export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTags) {
    const tag = normalizeTag(raw);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
      if (result.length >= MAX_TAGS_PER_ENTITY) break;
    }
  }

  return result;
}
