import { describe, it, expect } from "vitest";
import {
  buildPaymentRequired,
  buildRegistrationPaymentRequired,
  buildPublishPaymentRequired,
  buildReadPaymentRequired,
  extractPaymentProof,
  calculateReadFeeSplit,
  usdcToUnits,
  unitsToUsdc,
} from "../src/lib/x402";

describe("x402 helpers", () => {
  describe("buildPaymentRequired", () => {
    it("returns 402 status with correct headers", () => {
      const res = buildPaymentRequired({
        amount: "1.00",
        recipient: "0xTREASURY",
        memo: "registration_fee",
        description: "Test payment",
      });
      expect(res.status).toBe(402);
      expect(res.headers.get("X-Payment-Amount")).toBe("1.00");
      expect(res.headers.get("X-Payment-Recipient")).toBe("0xTREASURY");
      expect(res.headers.get("X-Payment-Memo")).toBe("registration_fee");
      expect(res.headers.get("X-Payment-Currency")).toBe("USDC");
      expect(res.headers.get("X-Payment-Chain")).toBe("base");
    });

    it("includes payment payload in body", async () => {
      const res = buildPaymentRequired({
        amount: "0.50",
        recipient: "0xABC",
        memo: "read_access:post123",
        description: "Unlock post",
      });
      const body = await res.json();
      expect(body.error).toBe("Payment Required");
      expect(body.payment.amount).toBe("0.50");
      expect(body.payment.contractAddress).toBeTruthy();
      expect(body.payment.chainId).toBe(8453);
    });
  });

  describe("buildRegistrationPaymentRequired", () => {
    it("returns 402 for $1.00 with registration_fee memo", async () => {
      const res = buildRegistrationPaymentRequired();
      expect(res.status).toBe(402);
      expect(res.headers.get("X-Payment-Amount")).toBe("1.00");
      expect(res.headers.get("X-Payment-Memo")).toBe("registration_fee");
    });
  });

  describe("buildPublishPaymentRequired", () => {
    it("returns 402 for $0.10 with publish_fee memo", async () => {
      const res = buildPublishPaymentRequired();
      expect(res.status).toBe(402);
      expect(res.headers.get("X-Payment-Amount")).toBe("0.10");
      expect(res.headers.get("X-Payment-Memo")).toBe("publish_fee");
    });
  });

  describe("buildReadPaymentRequired", () => {
    it("returns 402 with correct post-specific memo", async () => {
      const res = buildReadPaymentRequired("post-xyz", "0.75", "0xPAYOUT");
      expect(res.status).toBe(402);
      expect(res.headers.get("X-Payment-Amount")).toBe("0.75");
      expect(res.headers.get("X-Payment-Memo")).toBe("read_access:post-xyz");
      expect(res.headers.get("X-Payment-Recipient")).toBe("0xPAYOUT");
    });
  });

  describe("extractPaymentProof", () => {
    it("extracts payment headers from request", () => {
      const req = new Request("http://localhost", {
        headers: {
          "X-Payment-Response": "0xTX123",
          "X-Payer-Address": "0xPAYER",
        },
      });
      const proof = extractPaymentProof(req);
      expect(proof).not.toBeNull();
      expect(proof!.txRef).toBe("0xTX123");
      expect(proof!.payerAddress).toBe("0xPAYER");
    });

    it("returns null if no payment headers", () => {
      const req = new Request("http://localhost");
      const proof = extractPaymentProof(req);
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
