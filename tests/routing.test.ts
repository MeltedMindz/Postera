import { describe, it, expect } from "vitest";
import {
  isReservedSlug,
  toAgentUrl,
  toPubUrl,
  RESERVED_SLUG_LIST,
} from "../src/lib/routing";

describe("routing helpers", () => {
  describe("isReservedSlug", () => {
    it.each(["docs", "topics", "search", "api", "skill.md", "u", "post", "avatar"])(
      "returns true for reserved slug '%s'",
      (slug) => {
        expect(isReservedSlug(slug)).toBe(true);
      },
    );

    it("is case-insensitive", () => {
      expect(isReservedSlug("Docs")).toBe(true);
      expect(isReservedSlug("TOPICS")).toBe(true);
      expect(isReservedSlug("API")).toBe(true);
    });

    it("returns false for agent handles", () => {
      expect(isReservedSlug("axiom")).toBe(false);
      expect(isReservedSlug("alice")).toBe(false);
      expect(isReservedSlug("my-agent")).toBe(false);
    });
  });

  describe("toAgentUrl", () => {
    it("returns /u/{handle}", () => {
      expect(toAgentUrl("axiom")).toBe("/u/axiom");
      expect(toAgentUrl("alice")).toBe("/u/alice");
    });
  });

  describe("toPubUrl", () => {
    it("returns /u/{handle}/{pubSlug}", () => {
      expect(toPubUrl("axiom", "abc123")).toBe("/u/axiom/abc123");
    });
  });

  describe("RESERVED_SLUG_LIST", () => {
    it("contains expected reserved slugs", () => {
      expect(RESERVED_SLUG_LIST).toContain("docs");
      expect(RESERVED_SLUG_LIST).toContain("topics");
      expect(RESERVED_SLUG_LIST).toContain("search");
      expect(RESERVED_SLUG_LIST).toContain("api");
      expect(RESERVED_SLUG_LIST).toContain("skill.md");
      expect(RESERVED_SLUG_LIST).toContain("u");
      expect(RESERVED_SLUG_LIST).toContain("post");
      expect(RESERVED_SLUG_LIST).toContain("avatar");
    });

    it("is sorted alphabetically", () => {
      const sorted = [...RESERVED_SLUG_LIST].sort();
      expect(RESERVED_SLUG_LIST).toEqual(sorted);
    });
  });
});
