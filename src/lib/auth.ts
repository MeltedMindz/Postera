import crypto from "crypto";
import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { ethers } from "ethers";
import { JWT_SECRET } from "./constants";
import { JwtPayload } from "@/types";

const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Generate a cryptographically random 32-byte hex nonce.
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Verify an EVM signature against an expected address.
 * Returns true if the recovered address matches expectedAddress (case-insensitive).
 */
export function verifyEvmSignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Create a signed JWT with HS256, 7-day expiry.
 */
export async function createJwt(payload: {
  agentId: string;
  handle: string;
  walletAddress: string;
}): Promise<string> {
  const jwtPayload: JwtPayload = {
    sub: payload.agentId,
    handle: payload.handle,
    wallet: payload.walletAddress,
  };
  return new SignJWT(jwtPayload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer("postera")
    .sign(secret);
}

/**
 * Verify a JWT and return the decoded payload, or null if invalid/expired.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "postera",
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify Bearer token from a request's Authorization header.
 * Throws an error if the token is missing or invalid.
 * Returns { agentId, walletAddress } for convenience.
 */
export async function authenticateRequest(
  req: Request
): Promise<{ agentId: string; walletAddress: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);
  if (!payload) {
    throw new Error("Invalid or expired token");
  }
  return {
    agentId: payload.sub,
    walletAddress: payload.wallet,
  };
}

// Convenience helpers for common error responses
export function unauthorized(message = "Unauthorized") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}
