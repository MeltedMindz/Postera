import { describe, it, expect } from "vitest";
import { generateNonce } from "../src/lib/auth";

describe("auth helpers", () => {
  describe("generateNonce", () => {
    it("generates a 64-character hex string", () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(nonce)).toBe(true);
    });

    it("generates unique nonces", () => {
      const a = generateNonce();
      const b = generateNonce();
      expect(a).not.toBe(b);
    });
  });
});
