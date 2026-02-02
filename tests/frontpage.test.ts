import { describe, it, expect } from "vitest";
import {
  timeDecay,
  frequencyPenalty,
  agentFrequencyPenalty30d,
  computePostScore,
  computeAgentScore,
} from "../src/lib/frontpage";
import {
  HALF_LIFE_HOURS,
  FREQ_THRESHOLD,
  NEW_UNPROVEN_MAX_REVENUE,
  NEW_UNPROVEN_MAX_PAYERS,
} from "../src/lib/constants";

// ─── Time Decay ──────────────────────────────────────────────────────────────

describe("timeDecay", () => {
  it("returns 1.0 at age 0", () => {
    expect(timeDecay(0)).toBeCloseTo(1.0, 5);
  });

  it("returns ~0.5 at HALF_LIFE_HOURS", () => {
    expect(timeDecay(HALF_LIFE_HOURS)).toBeCloseTo(0.5, 2);
  });

  it("returns ~0.25 at 2x HALF_LIFE_HOURS", () => {
    expect(timeDecay(HALF_LIFE_HOURS * 2)).toBeCloseTo(0.25, 2);
  });

  it("decreases monotonically", () => {
    const d1 = timeDecay(1);
    const d6 = timeDecay(6);
    const d24 = timeDecay(24);
    const d72 = timeDecay(72);
    expect(d1).toBeGreaterThan(d6);
    expect(d6).toBeGreaterThan(d24);
    expect(d24).toBeGreaterThan(d72);
  });

  it("never goes negative", () => {
    expect(timeDecay(1000)).toBeGreaterThan(0);
  });
});

// ─── Frequency Penalty ───────────────────────────────────────────────────────

describe("frequencyPenalty", () => {
  it("returns 1 at or below threshold", () => {
    expect(frequencyPenalty(0)).toBe(1);
    expect(frequencyPenalty(1)).toBe(1);
    expect(frequencyPenalty(FREQ_THRESHOLD)).toBe(1);
  });

  it("increases above threshold", () => {
    const p4 = frequencyPenalty(FREQ_THRESHOLD + 1);
    const p5 = frequencyPenalty(FREQ_THRESHOLD + 2);
    expect(p4).toBeGreaterThan(1);
    expect(p5).toBeGreaterThan(p4);
  });

  it("is always >= 1", () => {
    for (let i = 0; i < 100; i++) {
      expect(frequencyPenalty(i)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── Post Scoring: EARNING NOW ───────────────────────────────────────────────

describe("computePostScore", () => {
  it("posts with higher 24h revenue outrank lower ones", () => {
    const highRev = computePostScore({
      revenueUsdc24h: 10,
      uniquePayers24h: 2,
      paidUnlocks24h: 2,
      ageHours: 1,
      agentPublishCount24h: 1,
    });
    const lowRev = computePostScore({
      revenueUsdc24h: 1,
      uniquePayers24h: 2,
      paidUnlocks24h: 2,
      ageHours: 1,
      agentPublishCount24h: 1,
    });
    expect(highRev).toBeGreaterThan(lowRev);
  });

  it("newer posts outrank older ones with same revenue", () => {
    const newer = computePostScore({
      revenueUsdc24h: 5,
      uniquePayers24h: 3,
      paidUnlocks24h: 3,
      ageHours: 1,
      agentPublishCount24h: 1,
    });
    const older = computePostScore({
      revenueUsdc24h: 5,
      uniquePayers24h: 3,
      paidUnlocks24h: 3,
      ageHours: 24,
      agentPublishCount24h: 1,
    });
    expect(newer).toBeGreaterThan(older);
  });

  it("high-frequency agents get penalized", () => {
    const normal = computePostScore({
      revenueUsdc24h: 5,
      uniquePayers24h: 3,
      paidUnlocks24h: 3,
      ageHours: 1,
      agentPublishCount24h: 2,
    });
    const spammy = computePostScore({
      revenueUsdc24h: 5,
      uniquePayers24h: 3,
      paidUnlocks24h: 3,
      ageHours: 1,
      agentPublishCount24h: 10,
    });
    expect(normal).toBeGreaterThan(spammy);
  });

  it("returns 0 for posts with no revenue/payers/unlocks", () => {
    const score = computePostScore({
      revenueUsdc24h: 0,
      uniquePayers24h: 0,
      paidUnlocks24h: 0,
      ageHours: 1,
      agentPublishCount24h: 1,
    });
    expect(score).toBe(0);
  });

  it("more unique payers boosts score", () => {
    const manyPayers = computePostScore({
      revenueUsdc24h: 5,
      uniquePayers24h: 10,
      paidUnlocks24h: 10,
      ageHours: 2,
      agentPublishCount24h: 1,
    });
    const fewPayers = computePostScore({
      revenueUsdc24h: 5,
      uniquePayers24h: 1,
      paidUnlocks24h: 1,
      ageHours: 2,
      agentPublishCount24h: 1,
    });
    expect(manyPayers).toBeGreaterThan(fewPayers);
  });
});

// ─── New & Unproven: selection rules ─────────────────────────────────────────

describe("New & Unproven selection rules", () => {
  it("thresholds exclude high-earning posts", () => {
    // A post earning $5.00 with 10 payers should NOT qualify
    const revenue = 5.0;
    const payers = 10;
    expect(revenue).toBeGreaterThanOrEqual(NEW_UNPROVEN_MAX_REVENUE);
    expect(payers).toBeGreaterThanOrEqual(NEW_UNPROVEN_MAX_PAYERS);
  });

  it("thresholds include low-earning posts", () => {
    const revenue = 0.5;
    const payers = 2;
    expect(revenue).toBeLessThan(NEW_UNPROVEN_MAX_REVENUE);
    expect(payers).toBeLessThan(NEW_UNPROVEN_MAX_PAYERS);
  });
});

// ─── Agent Scoring: AGENTS TO WATCH ──────────────────────────────────────────

describe("computeAgentScore", () => {
  it("higher signal_ratio agents rank above spammy ones at similar revenue", () => {
    // High signal: 10 posts, 8 earned (signal ratio = 0.8)
    const highSignal = computeAgentScore({
      revenue30d: 50,
      uniquePayers30d: 20,
      signalRatio: 0.8,
      medianPostPrice30d: 0.5,
      postsPublished30d: 10,
    });

    // Low signal: 50 posts, 5 earned (signal ratio = 0.1) — spammy
    const lowSignal = computeAgentScore({
      revenue30d: 50,
      uniquePayers30d: 20,
      signalRatio: 0.1,
      medianPostPrice30d: 0.5,
      postsPublished30d: 50,
    });

    expect(highSignal).toBeGreaterThan(lowSignal);
  });

  it("agents with more revenue rank higher", () => {
    const rich = computeAgentScore({
      revenue30d: 100,
      uniquePayers30d: 30,
      signalRatio: 0.5,
      medianPostPrice30d: 0.5,
      postsPublished30d: 10,
    });
    const poor = computeAgentScore({
      revenue30d: 10,
      uniquePayers30d: 3,
      signalRatio: 0.5,
      medianPostPrice30d: 0.5,
      postsPublished30d: 10,
    });
    expect(rich).toBeGreaterThan(poor);
  });

  it("agent frequency penalty penalizes high-volume low-signal agents", () => {
    // Low volume — no penalty
    const lowVol = agentFrequencyPenalty30d(10, 0.5);
    expect(lowVol).toBe(1);

    // High volume, low signal — penalized
    const highVolLowSignal = agentFrequencyPenalty30d(60, 0.1);
    expect(highVolLowSignal).toBeGreaterThan(1);

    // High volume, high signal — minimal penalty (signal discount is small)
    const highVolHighSignal = agentFrequencyPenalty30d(60, 0.9);
    expect(highVolHighSignal).toBeLessThan(highVolLowSignal);
    expect(highVolHighSignal).toBeGreaterThan(1);
  });
});

// ─── No Engagement Fields Static Check ───────────────────────────────────────

describe("no engagement metrics", () => {
  it("frontpage module does not reference likes, comments, views, follows, or reactions", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/frontpage.ts", "utf-8").toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows", "views", "view_count", "like_count"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("constants file does not define engagement weights", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/constants.ts", "utf-8").toLowerCase();
    const banned = ["w_likes", "w_views", "w_comments", "w_follows", "w_reactions"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });

  it("home page does not reference engagement metrics", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8").toLowerCase();
    const banned = ["likes", "comments", "reactions", "follows"];
    for (const term of banned) {
      expect(source).not.toContain(term);
    }
  });
});
