import { describe, it, expect } from "vitest";
import {
  buildPaymentRequiredResponse,
  buildRegistrationPaymentRequired,
  buildPublishPaymentRequired,
  buildReadPaymentRequired,
  extractPaymentProof,
  calculateReadFeeSplit,
  usdcToUnits,
  unitsToUsdc,
} from "../src/lib/x402";

describe("x402 helpers", () => {
  describe("buildPaymentRequiredResponse", () => {
    it("returns 402 status with x402 v2 format", async () => {
      const res = buildPaymentRequiredResponse({
        amount: "1.00",
        recipient: "0xTREASURY",
        memo: "registration_fee",
        description: "Test payment",
      });
      expect(res.status).toBe(402);
      
      const body = await res.json();
      expect(body.x402Version).toBe(2);
      expect(body.error).toBe("Payment Required");
      expect(body.accepts).toHaveLength(1);
    });

    it("includes correct payment requirements in body", async () => {
      const res = buildPaymentRequiredResponse({
        amount: "0.50",
        recipient: "0xABC",
        memo: "read_access:post123",
        description: "Unlock post",
      });
      const body = await res.json();
      
      expect(body.x402Version).toBe(2);
      expect(body.accepts[0].scheme).toBe("exact");
      expect(body.accepts[0].network).toBe("eip155:8453");
      expect(body.accepts[0].amount).toBe("500000"); // 0.50 USDC in units
      expect(body.accepts[0].payTo).toBe("0xABC");
      expect(body.accepts[0].extra.memo).toBe("read_access:post123");
      expect(body.accepts[0].extra.description).toBe("Unlock post");
    });
  });

  describe("buildRegistrationPaymentRequired", () => {
    it("returns 402 for $1.00 with registration_fee memo", async () => {
      const res = buildRegistrationPaymentRequired();
      expect(res.status).toBe(402);
      
      const body = await res.json();
      expect(body.x402Version).toBe(2);
      expect(body.accepts[0].amount).toBe("1000000"); // $1.00 in units
      expect(body.accepts[0].extra.memo).toBe("registration_fee");
    });
  });

  describe("buildPublishPaymentRequired", () => {
    it("returns 402 for $0.10 with publish_fee memo", async () => {
      const res = buildPublishPaymentRequired();
      expect(res.status).toBe(402);
      
      const body = await res.json();
      expect(body.x402Version).toBe(2);
      expect(body.accepts[0].amount).toBe("100000"); // $0.10 in units
      expect(body.accepts[0].extra.memo).toBe("publish_fee");
    });
  });

  describe("buildReadPaymentRequired", () => {
    it("returns 402 with correct post-specific memo and recipient", async () => {
      const res = buildReadPaymentRequired("post-xyz", "0.75", "0xPAYOUT");
      expect(res.status).toBe(402);
      
      const body = await res.json();
      expect(body.x402Version).toBe(2);
      expect(body.accepts[0].amount).toBe("750000"); // $0.75 in units
      expect(body.accepts[0].extra.memo).toBe("read_access:post-xyz");
      expect(body.accepts[0].payTo).toBe("0xPAYOUT");
    });
  });

  describe("extractPaymentProof", () => {
    it("extracts payment from x402 v2 request body", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x402Version: 2,
          payload: {
            txHash: "0xTX123",
            payerAddress: "0xPAYER",
          },
          accepted: {
            network: "eip155:8453",
          },
        }),
      });
      const proof = await extractPaymentProof(req);
      expect(proof).not.toBeNull();
      expect(proof!.txRef).toBe("0xTX123");
      expect(proof!.payerAddress).toBe("0xPAYER");
      expect(proof!.network).toBe("eip155:8453");
    });

    it("falls back to headers for backward compatibility", async () => {
      const req = new Request("http://localhost", {
        headers: {
          "X-Payment-Response": "0xTX456",
          "X-Payer-Address": "0xPAYER2",
        },
      });
      const proof = await extractPaymentProof(req);
      expect(proof).not.toBeNull();
      expect(proof!.txRef).toBe("0xTX456");
      expect(proof!.payerAddress).toBe("0xPAYER2");
    });

    it("returns null if no payment data", async () => {
      const req = new Request("http://localhost");
      const proof = await extractPaymentProof(req);
      expect(proof).toBeNull();
    });
  });

  describe("calculateReadFeeSplit", () => {
    it("splits 90/10 correctly", () => {
      const split = calculateReadFeeSplit("1.00");
      expect(split.creatorAmount).toBe("0.90");
      expect(split.platformAmount).toBe("0.10");
    });

    it("handles small amounts", () => {
      const split = calculateReadFeeSplit("0.10");
      expect(split.creatorAmount).toBe("0.09");
      expect(split.platformAmount).toBe("0.01");
    });
  });

  describe("USDC conversion", () => {
    it("converts decimal to units", () => {
      expect(usdcToUnits("1.00")).toBe(1_000_000n);
      expect(usdcToUnits("0.10")).toBe(100_000n);
      expect(usdcToUnits("0.50")).toBe(500_000n);
    });

    it("converts units to decimal", () => {
      expect(unitsToUsdc(1_000_000n)).toBe("1.000000");
      expect(unitsToUsdc(100_000n)).toBe("0.100000");
    });
  });
});
