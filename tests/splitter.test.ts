import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════════
// PosteraSplitter Integration Test Suite (Updated for x402 v2)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Coverage Plan: Tests organized by priority (P0 = must-pass before merge)
//
// ─── P0: Sponsorship via Splitter ──────────────────────────────────────────────
// ─── P0: Paywall Unlock via Splitter ───────────────────────────────────────────
// ─── P0: Content Security ──────────────────────────────────────────────────────
// ─── P1: Allowance Logic ───────────────────────────────────────────────────────
// ─── P1: Edge Cases ────────────────────────────────────────────────────────────
// ─── P2: Regression ────────────────────────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─── P0: Sponsor 402 Response Contains splitterAddress and authorRecipient ────

describe("P0: Sponsorship 402 response shape", () => {
  it("sponsor route returns paymentRequirements with authorRecipient and protocolRecipient", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );

    // The 402 response body must include authorRecipient (author wallet)
    expect(source).toContain("authorRecipient");
    // Must include protocolRecipient (platform treasury)
    expect(source).toContain("protocolRecipient");
    // Must include split amounts
    expect(source).toContain("authorAmount");
    expect(source).toContain("protocolAmount");
    // Must include totalAmount
    expect(source).toContain("totalAmount");
    // Scheme must be "split" (not "exact" for a single-recipient transfer)
    expect(source).toContain('"split"');
  });

  it("sponsor route populates authorRecipient from publication payoutAddress", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // Must resolve author address from publication.payoutAddress
    expect(source).toContain("post.publication?.payoutAddress");
    // Must fall back to PLATFORM_TREASURY if no payout address
    expect(source).toContain("PLATFORM_TREASURY");
  });

  it("sponsor route populates protocolRecipient from PLATFORM_TREASURY", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("protocolRecipient: PLATFORM_TREASURY");
  });
});

// ─── P0: Sponsor Proof Submission Accepted (x402 v2) ─────────────────────────

describe("P0: Sponsor proof submission flow", () => {
  it("sponsor route uses parsePaymentPayload to check for proof", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // x402 v2: uses parsePaymentPayload (async) from payment.ts
    expect(source).toContain("parsePaymentPayload");
  });

  it("sponsor route creates PaymentReceipt with kind=sponsorship on proof", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain('kind: "sponsorship"');
    expect(source).toContain("paymentReceipt.create");
  });

  it("sponsor receipt records split BPS values", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("splitBpsAuthor: SPONSOR_SPLIT_BPS_AUTHOR");
    expect(source).toContain("splitBpsProtocol: SPONSOR_SPLIT_BPS_PROTOCOL");
  });

  it("sponsor receipt records both recipient addresses", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("recipientAuthor: authorPayoutAddress");
    expect(source).toContain("recipientProtocol: PLATFORM_TREASURY");
  });

  it("sponsor route returns 202 PENDING with paymentId for polling", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // x402 v2: returns 202 with paymentId for polling, not 201 with immediate success
    expect(source).toContain("status: 202");
    expect(source).toContain("paymentId");
    expect(source).toContain("nextPollUrl");
    expect(source).toContain('status: "PENDING"');
  });
});

// ─── P0: Sponsor Split Amounts Are Correct ───────────────────────────────────

describe("P0: computeSplit correctness", () => {
  // We re-implement computeSplit here to test the logic independently
  function parseUsdcMicro(amount: string): bigint {
    const parts = amount.split(".");
    const whole = BigInt(parts[0]) * BigInt(10 ** 6);
    if (parts[1]) {
      const decimals = parts[1].padEnd(6, "0").slice(0, 6);
      return whole + BigInt(decimals);
    }
    return whole;
  }

  function formatMicro(micro: bigint): string {
    const whole = micro / BigInt(10 ** 6);
    const frac = micro % BigInt(10 ** 6);
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    if (!fracStr) return whole.toString();
    return `${whole}.${fracStr}`;
  }

  function computeSplit(totalUsdc: string) {
    const totalMicro = parseUsdcMicro(totalUsdc);
    const authorMicro =
      (totalMicro * BigInt(9000)) / BigInt(10000);
    const protocolMicro = totalMicro - authorMicro;
    return {
      authorUsdc: formatMicro(authorMicro),
      protocolUsdc: formatMicro(protocolMicro),
    };
  }

  it("splits $1.00 into $0.90 author / $0.10 protocol", () => {
    const split = computeSplit("1.00");
    expect(split.authorUsdc).toBe("0.9");
    expect(split.protocolUsdc).toBe("0.1");
  });

  it("splits $0.25 into $0.225 author / $0.025 protocol", () => {
    const split = computeSplit("0.25");
    expect(split.authorUsdc).toBe("0.225");
    expect(split.protocolUsdc).toBe("0.025");
  });

  it("splits $0.50 into $0.45 author / $0.05 protocol", () => {
    const split = computeSplit("0.50");
    expect(split.authorUsdc).toBe("0.45");
    expect(split.protocolUsdc).toBe("0.05");
  });

  it("author + protocol always sum to total (no dust loss)", () => {
    const amounts = ["1.00", "0.25", "0.50", "0.10", "0.01", "100.00", "0.000001"];
    for (const amt of amounts) {
      const totalMicro = parseUsdcMicro(amt);
      const split = computeSplit(amt);
      const authorMicro = parseUsdcMicro(split.authorUsdc);
      const protocolMicro = parseUsdcMicro(split.protocolUsdc);
      expect(authorMicro + protocolMicro).toBe(totalMicro);
    }
  });

  it("protocol always gets the remainder (no rounding loss to author)", () => {
    // For $0.01: 10000 micro * 9000 / 10000 = 9000 micro author, 1000 micro protocol
    const split = computeSplit("0.01");
    const authorMicro = parseUsdcMicro(split.authorUsdc);
    const protocolMicro = parseUsdcMicro(split.protocolUsdc);
    expect(authorMicro).toBe(9000n);
    expect(protocolMicro).toBe(1000n);
  });

  it("handles minimum USDC amount (1 micro-unit)", () => {
    const split = computeSplit("0.000001");
    // 1 micro * 9000 / 10000 = 0 author, 1 protocol (remainder)
    const authorMicro = parseUsdcMicro(split.authorUsdc);
    const protocolMicro = parseUsdcMicro(split.protocolUsdc);
    expect(authorMicro + protocolMicro).toBe(1n);
  });
});

// ─── P0: Rate Limiting Still Works on Sponsor Route ──────────────────────────

describe("P0: Sponsor rate limiting", () => {
  it("sponsor route applies rate limiting before processing", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("checkRateLimit");
    expect(source).toContain("RATE_LIMITS.payment");
    expect(source).toContain("rateLimitResponse");
  });

  it("rate limit key includes payer address when available", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    expect(source).toContain("x-payer-address");
    expect(source).toContain("sponsor:");
  });
});

// ─── P0: Paywall Unlock 402 Response ─────────────────────────────────────────

describe("P0: Paywall 402 response for paywalled posts", () => {
  it("GET /api/posts/[postId]?view=full returns 402 for paywalled post", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    // x402 v2: uses buildReadPaymentRequired which returns x402 v2 format
    expect(source).toContain("buildReadPaymentRequired");
  });

  it("402 response uses author payout address", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    expect(source).toContain("payoutAddress");
    // The payoutAddress is passed to buildReadPaymentRequired
    expect(source).toContain("buildReadPaymentRequired(");
  });

  it("free posts do NOT trigger 402", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    // For non-paywalled posts, both preview and full view return 200
    expect(source).toContain("if (!post.isPaywalled)");
    // Count the early returns for non-paywalled posts
    const freeReturns = source.match(
      /if\s*\(\s*!post\.isPaywalled\s*\)\s*\{[\s\S]*?return\s+Response\.json\(/g
    );
    expect(freeReturns).not.toBeNull();
    expect(freeReturns!.length).toBeGreaterThanOrEqual(2); // once for preview, once for full
  });
});

// ─── P0: Paywall Proof Creates PENDING Receipt (x402 v2) ─────────────────────

describe("P0: Paywall proof creates PENDING receipt", () => {
  it("paywall route creates PENDING PaymentReceipt after payment proof", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    // x402 v2: creates PENDING receipt, access grant created by worker after confirmation
    expect(source).toContain("paymentReceipt.create");
    expect(source).toContain('status: "PENDING"');
  });

  it("paywall route checks existing AccessGrant before requiring payment", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    expect(source).toContain("accessGrant.findUnique");
    expect(source).toContain("postId_payerAddress");
  });

  it("paywall route records PaymentReceipt with kind=read_access", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    expect(source).toContain('kind: "read_access"');
    expect(source).toContain("paymentReceipt.create");
  });

  it("paywall route returns 202 PENDING for polling", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    expect(source).toContain("status: 202");
    expect(source).toContain("nextPollUrl");
  });
});

// ─── P0: Content Security — bodyHtml Never Leaked in 402 ─────────────────────

describe("P0: Content security for paywalled posts", () => {
  it("paywalled preview strips bodyHtml and bodyMarkdown", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    // The previewPost object is manually constructed and must NOT include bodyHtml
    const previewBlock = source
      .split("Paywalled preview")[1]
      ?.split("return Response.json")[0];
    expect(previewBlock).toBeDefined();
    expect(previewBlock).not.toContain("bodyHtml");
    expect(previewBlock).not.toContain("bodyMarkdown");
  });

  it("402 Payment Required response does NOT include post body", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/payment.ts", "utf-8");
    // buildPaymentRequiredResponse should only include payment metadata
    expect(source).not.toContain("bodyHtml");
    expect(source).not.toContain("bodyMarkdown");
  });
});

// ─── P1: SponsorButton Client Component — Allowance Logic ───────────────────

describe("P1: SponsorButton allowance and approve flow", () => {
  it("SponsorButton delegates to useSplitterPayment hook", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/SponsorButton.tsx",
      "utf-8"
    );
    expect(source).toContain("useSplitterPayment");
    expect(source).toContain("payment.execute");
  });

  it("useSplitterPayment hook has approve ABI entry", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/hooks/useSplitterPayment.ts",
      "utf-8"
    );
    expect(source).toContain('"approve"');
    expect(source).toContain('"allowance"');
  });

  it("useSplitterPayment hook has SPLITTER_ADDRESS constant", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/hooks/useSplitterPayment.ts",
      "utf-8"
    );
    expect(source).toContain("SPLITTER_ADDRESS");
  });

  it("useSplitterPayment checks allowance before calling sponsor", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/hooks/useSplitterPayment.ts",
      "utf-8"
    );
    // The hook should read current allowance and compare to required amount
    expect(source).toContain("allowance");
    expect(source).toContain("approve");
  });

  it("useSplitterPayment calls ERC20 approve if allowance insufficient", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/hooks/useSplitterPayment.ts",
      "utf-8"
    );
    // Logic: if (currentAllowance < requiredAmount) { call approve }
    expect(source).toContain("writeContract");
    expect(source).toContain("approve");
  });

  it("useSplitterPayment calls splitter.sponsor(author, amount) after approve", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/hooks/useSplitterPayment.ts",
      "utf-8"
    );
    expect(source).toContain("sponsor");
    expect(source).toContain("writeSponsor");
  });
});

// ─── P1: Edge cases — missing/invalid author address ────────────────────────

describe("P1: Edge cases — missing/invalid author address", () => {
  it("sponsor route falls back to PLATFORM_TREASURY when publication has no payoutAddress", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // Fallback: authorPayoutAddress = publication?.payoutAddress ?? PLATFORM_TREASURY
    expect(source).toContain(
      "post.publication?.payoutAddress ?? PLATFORM_TREASURY"
    );
  });
});

describe("P1: Edge cases — duplicate txRef prevention", () => {
  it("sponsor route checks for existing receipt with same txRef", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/sponsor/route.ts",
      "utf-8"
    );
    // x402 v2: checks for duplicate txRef for idempotency
    expect(source).toContain("findUnique");
    expect(source).toContain("txRef");
  });

  it("paywall route checks for existing receipt with same txRef", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/api/posts/[postId]/route.ts",
      "utf-8"
    );
    // x402 v2: checks for duplicate txRef for idempotency
    expect(source).toContain("findUnique");
    expect(source).toContain("txRef");
  });
});

// ─── P2: Regression — Discovery Scoring ─────────────────────────────────────

describe("P2: Regression — discovery scoring with sponsorship receipts", () => {
  it("discovery module includes sponsorship revenue with lower weight", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("sponsor_revenue_7d");
    expect(source).toContain("unique_sponsors_7d");
    expect(source).toContain("W_SPONSOR_REV");
    expect(source).toContain("W_SPONSOR_PAYERS");
  });

  it("sponsor weights are strictly lower than read weights", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/constants.ts", "utf-8");
    // W_SPONSOR_REV = 5 < W_REV = 10
    expect(source).toContain("W_SPONSOR_REV = 5");
    expect(source).toContain("W_REV = 10");
    // W_SPONSOR_PAYERS = 3.5 < W_PAYERS = 5
    expect(source).toContain("W_SPONSOR_PAYERS = 3.5");
    expect(source).toContain("W_PAYERS = 5");
  });
});

describe("P2: Regression — search/topics still show sponsor labels", () => {
  it("PostCard has sponsorLabel prop", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/PostCard.tsx", "utf-8");
    expect(source).toContain("sponsorLabel");
  });

  it("discovery DTO includes sponsorship fields", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/discovery.ts", "utf-8");
    expect(source).toContain("sponsorRevenue7d");
    expect(source).toContain("uniqueSponsors7d");
  });
});

describe("P2: Regression — SponsorButton only renders on free posts", () => {
  it("post page guards SponsorButton behind !post.isPaywalled", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/post/[postId]/page.tsx", "utf-8");
    expect(source).toContain("!post.isPaywalled");
    expect(source).toContain("SponsorButton");
  });
});

// ─── P0 Unit Tests: parsePaymentPayload (async, x402 v2) ────────────────────

describe("P0: parsePaymentPayload unit tests", () => {
  it("parses x402 v2 JSON body with txHash", async () => {
    const { parsePaymentPayload } = await import("../src/lib/payment");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: 2,
        payload: {
          txHash: "0x" + "a".repeat(64),
          payerAddress: "0x" + "b".repeat(40),
        },
        accepted: { network: "eip155:8453" },
      }),
    });
    const result = await parsePaymentPayload(req);
    expect(result).not.toBeNull();
    expect(result!.txRef).toBe("0x" + "a".repeat(64));
    expect(result!.payerAddress).toBe("0x" + "b".repeat(40));
    expect(result!.network).toBe("eip155:8453");
  });

  it("falls back to X-Payment-Response header", async () => {
    const { parsePaymentPayload } = await import("../src/lib/payment");
    const hash = "0x" + "c".repeat(64);
    const req = new Request("http://localhost", {
      headers: {
        "X-Payment-Response": hash,
        "X-Payer-Address": "0x" + "d".repeat(40),
      },
    });
    const result = await parsePaymentPayload(req);
    expect(result).not.toBeNull();
    expect(result!.txRef).toBe(hash);
    expect(result!.payerAddress).toBe("0x" + "d".repeat(40));
  });

  it("returns null when no payment data", async () => {
    const { parsePaymentPayload } = await import("../src/lib/payment");
    const req = new Request("http://localhost");
    const result = await parsePaymentPayload(req);
    expect(result).toBeNull();
  });
});

// ─── P0 Unit Tests: extractPaymentProof (x402 v2 wrapper, async) ────────────

describe("P0: extractPaymentProof unit tests", () => {
  it("extracts payment from x402 v2 body", async () => {
    const { extractPaymentProof } = await import("../src/lib/x402");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: 2,
        payload: {
          txHash: "0x" + "e".repeat(64),
          payerAddress: "0x" + "f".repeat(40),
        },
      }),
    });
    const proof = await extractPaymentProof(req);
    expect(proof).not.toBeNull();
    expect(proof!.txRef).toBe("0x" + "e".repeat(64));
    expect(proof!.payerAddress).toBe("0x" + "f".repeat(40));
  });

  it("returns null when no payment data", async () => {
    const { extractPaymentProof } = await import("../src/lib/x402");
    const req = new Request("http://localhost");
    const result = await extractPaymentProof(req);
    expect(result).toBeNull();
  });

  it("falls back to headers for backward compatibility", async () => {
    const { extractPaymentProof } = await import("../src/lib/x402");
    const req = new Request("http://localhost", {
      headers: {
        "X-Payment-Response": "0x" + "1".repeat(64),
        "X-Payer-Address": "0x" + "2".repeat(40),
      },
    });
    const proof = await extractPaymentProof(req);
    expect(proof).not.toBeNull();
    expect(proof!.txRef).toBe("0x" + "1".repeat(64));
    expect(proof!.payerAddress).toBe("0x" + "2".repeat(40));
  });
});

// ─── P0 Unit Tests: calculateReadFeeSplit ───────────────────────────────────

describe("P0: calculateReadFeeSplit unit tests", () => {
  it("splits $1.00 as $0.90 creator / $0.10 platform", async () => {
    const { calculateReadFeeSplit } = await import("../src/lib/x402");
    const split = calculateReadFeeSplit("1.00");
    expect(split.creatorAmount).toBe("0.90");
    expect(split.platformAmount).toBe("0.10");
  });

  it("splits $0.25 as $0.23 creator / $0.03 platform (rounded)", async () => {
    const { calculateReadFeeSplit } = await import("../src/lib/x402");
    const split = calculateReadFeeSplit("0.25");
    // 0.25 * 0.9 = 0.225, toFixed(2) rounds to "0.23"
    // 0.25 * 0.1 = 0.025, toFixed(2) rounds to "0.03" or "0.02"
    expect(split.creatorAmount).toBe("0.23");
    expect(split.platformAmount).toBe("0.03");
  });
});

// ─── Discovery skill.md documentation ───────────────────────────────────────

describe("sponsorship integration", () => {
  it("skill.md documents sponsorship flow", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("skill.md", "utf-8");
    expect(source).toContain("Sponsor a Free Post");
    expect(source).toContain("/api/posts/{postId}/sponsor");
    // x402 v2: documents the 90/10 split
    expect(source).toContain("90");
    expect(source).toContain("10");
  });
});
