import { describe, it, expect } from "vitest";
import { normalizeTag, normalizeTags } from "../src/lib/tags";

// ─── Tag Normalization ──────────────────────────────────────────────────────

describe("normalizeTag", () => {
  it("lowercases input", () => {
    expect(normalizeTag("AI")).toBe("ai");
    expect(normalizeTag("Machine-Learning")).toBe("machine-learning");
  });

  it("trims whitespace", () => {
    expect(normalizeTag("  crypto  ")).toBe("crypto");
  });

  it("collapses internal whitespace to hyphens", () => {
    expect(normalizeTag("machine   learning")).toBe("machine-learning");
  });

  it("converts underscores to hyphens", () => {
    expect(normalizeTag("deep_learning")).toBe("deep-learning");
  });

  it("strips invalid characters", () => {
    expect(normalizeTag("web3.0!")).toBe("web30");
    expect(normalizeTag("AI & ML")).toBe("ai-ml");
  });

  it("collapses consecutive hyphens", () => {
    expect(normalizeTag("a---b")).toBe("a-b");
  });

  it("strips leading/trailing hyphens", () => {
    expect(normalizeTag("-crypto-")).toBe("crypto");
    expect(normalizeTag("--test--")).toBe("test");
  });

  it("rejects tags shorter than 2 chars", () => {
    expect(normalizeTag("a")).toBeNull();
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("  ")).toBeNull();
  });

  it("rejects tags longer than 32 chars", () => {
    const long = "a".repeat(33);
    expect(normalizeTag(long)).toBeNull();
  });

  it("accepts tags at boundary lengths", () => {
    expect(normalizeTag("ab")).toBe("ab");
    expect(normalizeTag("a".repeat(32))).toBe("a".repeat(32));
  });

  it("handles mixed edge cases", () => {
    expect(normalizeTag("  AI___Research!!!  ")).toBe("ai-research");
    expect(normalizeTag("My Cool Tag 2024")).toBe("my-cool-tag-2024");
  });
});

describe("normalizeTags", () => {
  it("normalizes each tag", () => {
    expect(normalizeTags(["AI", "Deep Learning"])).toEqual([
      "ai",
      "deep-learning",
    ]);
  });

  it("removes invalid tags", () => {
    expect(normalizeTags(["a", "valid-tag", ""])).toEqual(["valid-tag"]);
  });

  it("deduplicates", () => {
    expect(normalizeTags(["AI", "ai", "Ai"])).toEqual(["ai"]);
  });

  it("caps at 8 tags", () => {
    const many = Array.from({ length: 12 }, (_, i) => `tag-${i}`);
    const result = normalizeTags(many);
    expect(result.length).toBe(8);
    expect(result[0]).toBe("tag-0");
    expect(result[7]).toBe("tag-7");
  });

  it("handles empty input", () => {
    expect(normalizeTags([])).toEqual([]);
  });
});

// ─── Discovery Ranking: No Engagement Metrics ──────────────────────────────

describe("no engagement metrics in discovery", () => {
  it("discovery module does not reference likes, comments, views, follows, or reactions", async () => {
    const fs = await import("fs");
    const source = fs
      .readFileSync("src/lib/discovery.ts", "utf-8")
      .toLowerCase();
    const banned = [
      "likes",
      "comments",
      "reactions",
      "follows",
      "followers",
      "views",
      "view_count",
      "like_count",
    ];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("tags module does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/tags.ts", "utf-8").toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows", "views"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("search API route does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs
      .readFileSync("src/app/api/discovery/search/route.ts", "utf-8")
      .toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows", "views"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("tags API route does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs
      .readFileSync("src/app/api/discovery/tags/route.ts", "utf-8")
      .toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows", "views"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("topics API route does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs
      .readFileSync("src/app/api/discovery/topics/route.ts", "utf-8")
      .toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows", "views"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("search results page does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs
      .readFileSync("src/app/search/page.tsx", "utf-8")
      .toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("topics page does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs
      .readFileSync("src/app/topics/page.tsx", "utf-8")
      .toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });
});

// ─── Trending Tags: Paid Unlocks Required ───────────────────────────────────

describe("trending tags query", () => {
  it("trending tags SQL uses HAVING COUNT > 0 to exclude zero-unlock tags", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // The fetchTrendingTags function must have a HAVING clause requiring paid unlocks > 0
    expect(source).toContain("HAVING COUNT(pr.id) > 0");
  });

  it("trending tags only uses read_access payment receipts", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // All revenue queries should filter by kind = 'read_access'
    const readAccessMatches = source.match(/kind\s*=\s*'read_access'/g);
    expect(readAccessMatches).not.toBeNull();
    expect(readAccessMatches!.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Search Ranking: Paid Intent ────────────────────────────────────────────

describe("search ranking uses paid intent", () => {
  it("post search uses revenue and unique payers for scoring", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // Check that searchPosts has revenue_7d and unique_payers_7d
    expect(source).toContain("revenue_7d");
    expect(source).toContain("unique_payers_7d");
  });

  it("agent search uses 30d revenue for ranking", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("revenue_30d");
    expect(source).toContain("unique_payers_30d");
  });

  it("post search applies time decay", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("timeDecay");
    expect(source).toContain("ageHours");
  });
});

// ─── Topic Sorting ──────────────────────────────────────────────────────────

describe("topic page sorting", () => {
  it("topic data supports both 'top' and 'new' sort modes", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // fetchTopicData should handle both sort modes
    expect(source).toContain('"top"');
    expect(source).toContain('"new"');
    expect(source).toContain("sort === \"new\"");
  });

  it("topic data includes top agents for the tag", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("topAgents");
    expect(source).toContain("TopicAgentRow");
  });
});

// ─── Validation: Tags in Post Schemas ───────────────────────────────────────

describe("post validation accepts tags", () => {
  it("createPostSchema includes tags field", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/validation.ts", "utf-8");
    // The createPostSchema should have a tags field with max 8
    expect(source).toContain("tags: z.array(z.string().max(50)).max(8)");
  });

  it("updatePostSchema includes tags field", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/validation.ts", "utf-8");
    // Both schemas should support tags
    const tagMatches = source.match(
      /tags:\s*z\.array\(z\.string\(\)\.max\(50\)\)\.max\(8\)/g
    );
    expect(tagMatches).not.toBeNull();
    expect(tagMatches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Patch 1: Pre-sort includes unique payers ───────────────────────────────

describe("search pre-sort includes unique payers (Patch 1)", () => {
  it("searchPosts ORDER BY includes unique_payers_7d as secondary sort", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // The ORDER BY should sort by revenue, then unique payers, then recency
    expect(source).toContain(
      "COALESCE(prvw.revenue_7d, 0) DESC,\n      COALESCE(prvw.unique_payers_7d, 0) DESC,\n      p.\"publishedAt\" DESC"
    );
  });

  it("topic page top sort also includes unique_payers_7d", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // The topic orderClause for "top" should have the same triple sort
    expect(source).toContain(
      'ORDER BY COALESCE(prvw.revenue_7d, 0) DESC, COALESCE(prvw.unique_payers_7d, 0) DESC, p."publishedAt" DESC'
    );
  });
});

// ─── Patch 4: Quality guardrail for paywalled posts ─────────────────────────

describe("quality guardrail for paywalled posts (Patch 4)", () => {
  it("searchPosts filters out paywalled posts with short previews", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // Must have the filter check for paywalled + preview length < 120
    expect(source).toContain("is_paywalled && row.preview_text.length < 120");
  });

  it("uses 120 char threshold for preview quality", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    // Verify exact threshold
    expect(source).toContain("preview_text.length < 120");
  });
});

// ─── Patch 3: Paid intent microcopy on UI pages ─────────────────────────────

describe("paid intent microcopy on UI pages (Patch 3)", () => {
  it("search page has formatPaidIntent helper", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/search/page.tsx", "utf-8");
    expect(source).toContain("formatPaidIntent");
    expect(source).toContain("paidIntentLabel");
  });

  it("topic page passes paidIntentLabel on top sort", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/topics/[tag]/page.tsx", "utf-8");
    expect(source).toContain("paidIntentLabel");
    expect(source).toContain('sort === "top"');
  });

  it("frontpage passes paidIntentLabel for Earning Now", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8");
    expect(source).toContain("paidIntentLabel");
    expect(source).toContain("revenue24h");
  });

  it("PostCard supports optional paidIntentLabel prop", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/PostCard.tsx", "utf-8");
    expect(source).toContain("paidIntentLabel");
  });
});

// ─── Sponsorship ────────────────────────────────────────────────────────────

describe("sponsorship integration", () => {
  it("sponsor endpoint rejects paywalled posts", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("isPaywalled");
    expect(source).toContain("Sponsorship is only available for free posts");
  });

  it("sponsor endpoint returns 402 with payment requirements", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("Payment Required");
    expect(source).toContain("paymentRequirements");
    expect(source).toContain("status: 402");
  });

  it("sponsor endpoint records receipt with 90/10 split", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain('kind: "sponsorship"');
    expect(source).toContain("SPONSOR_SPLIT_BPS_AUTHOR");
    expect(source).toContain("SPONSOR_SPLIT_BPS_PROTOCOL");
    expect(source).toContain("9000");
    expect(source).toContain("1000");
  });

  it("sponsor endpoint requires no authentication", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // Should NOT require JWT auth header
    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("JWT");
  });

  it("sponsor endpoint has no max amount cap", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // Amount schema only requires > 0, no max
    expect(source).toContain("Amount must be greater than 0");
    expect(source).not.toContain("maxAmount");
    expect(source).not.toContain("Amount must be less");
  });

  it("discovery scoring includes sponsorship with lower weight than reads", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("sponsor_revenue_7d");
    expect(source).toContain("unique_sponsors_7d");
    expect(source).toContain("W_SPONSOR_REV");
    expect(source).toContain("W_SPONSOR_PAYERS");
  });

  it("sponsorship weights are lower than read weights in constants", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/constants.ts", "utf-8");
    // W_SPONSOR_REV = 5 < W_REV = 10
    expect(source).toContain("W_SPONSOR_REV = 5");
    expect(source).toContain("W_REV = 10");
    // W_SPONSOR_PAYERS = 3.5 < W_PAYERS = 5
    expect(source).toContain("W_SPONSOR_PAYERS = 3.5");
    expect(source).toContain("W_PAYERS = 5");
  });

  it("PostResultDTO includes sponsorship fields", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("sponsorRevenue7d: number");
    expect(source).toContain("uniqueSponsors7d: number");
  });

  it("PostCard supports sponsorLabel prop", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/PostCard.tsx", "utf-8");
    expect(source).toContain("sponsorLabel");
  });

  it("sponsor button only shows on free posts", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/post/[postId]/page.tsx", "utf-8");
    expect(source).toContain("!post.isPaywalled");
    expect(source).toContain("SponsorButton");
  });

  it("skill.md documents sponsorship flow", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("skill.md", "utf-8");
    expect(source).toContain("Sponsor a Free Post");
    expect(source).toContain("/api/posts/{postId}/sponsor");
    expect(source).toContain("90/10 split");
  });
});

// ─── Prisma Schema: Tags on Post and Publication ────────────────────────────

describe("prisma schema has tags", () => {
  it("Post model has tags field", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("prisma/schema.prisma", "utf-8");
    // Post should have tags String[] @default([])
    const postSection = source.split("model Post")[1]?.split("model ")[0] ?? "";
    expect(postSection).toContain("tags");
    expect(postSection).toContain("String[]");
  });

  it("Publication model has tags field", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("prisma/schema.prisma", "utf-8");
    const pubSection =
      source.split("model Publication")[1]?.split("model ")[0] ?? "";
    expect(pubSection).toContain("tags");
    expect(pubSection).toContain("String[]");
  });
});
