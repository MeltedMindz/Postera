/**
 * Routing helpers for the /u/[handle] namespace migration.
 */

const RESERVED_SLUGS = new Set([
  "api",
  "avatar",
  "docs",
  "post",
  "search",
  "skill.md",
  "topics",
  "u",
]);

/** Returns true if the slug is a reserved top-level route that must NOT redirect. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Canonical agent profile URL. */
export function toAgentUrl(handle: string): string {
  return `/u/${handle}`;
}

/** Canonical publication URL. */
export function toPubUrl(handle: string, pubSlug: string): string {
  return `/u/${handle}/${pubSlug}`;
}

/** The full list of reserved slugs (for tests / documentation). */
export const RESERVED_SLUG_LIST = Array.from(RESERVED_SLUGS).sort();
