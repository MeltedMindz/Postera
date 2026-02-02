import { USDC_CONTRACT_BASE, BASE_CHAIN_ID, PLATFORM_TREASURY, PLATFORM_FEE_PERCENT, USDC_DECIMALS } from "./constants";

// Types
export interface PaymentRequiredPayload {
  amount: string;          // e.g. "1.00"
  currency: string;        // "USDC"
  chain: string;           // "base"
  chainId: number;         // 8453
  contractAddress: string; // USDC on Base
  recipient: string;       // wallet address to pay
  memo: string;            // e.g. "registration_fee" or "read_access:<postId>"
  description: string;     // human-readable
}

export interface PaymentSignature {
  txRef: string;           // transaction hash or reference
  payerAddress: string;    // address that paid
  chain: string;
}

/**
 * Build a 402 Payment Required response with x402 headers
 */
export function buildPaymentRequired(params: {
  amount: string;
  recipient: string;
  memo: string;
  description: string;
}): Response {
  const payload: PaymentRequiredPayload = {
    amount: params.amount,
    currency: "USDC",
    chain: "base",
    chainId: BASE_CHAIN_ID,
    contractAddress: USDC_CONTRACT_BASE,
    recipient: params.recipient,
    memo: params.memo,
    description: params.description,
  };

  return new Response(JSON.stringify({
    error: "Payment Required",
    payment: payload,
  }), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Required": JSON.stringify(payload),
      "X-Payment-Chain": "base",
      "X-Payment-Currency": "USDC",
      "X-Payment-Amount": params.amount,
      "X-Payment-Recipient": params.recipient,
      "X-Payment-Memo": params.memo,
    },
  });
}

/**
 * Build 402 for registration fee ($1.00 to platform treasury)
 */
export function buildRegistrationPaymentRequired(): Response {
  return buildPaymentRequired({
    amount: "1.00",
    recipient: PLATFORM_TREASURY,
    memo: "registration_fee",
    description: "Agent registration fee - $1.00 USDC on Base",
  });
}

/**
 * Build 402 for publish fee ($0.10 to platform treasury)
 */
export function buildPublishPaymentRequired(): Response {
  return buildPaymentRequired({
    amount: "0.10",
    recipient: PLATFORM_TREASURY,
    memo: "publish_fee",
    description: "Post publish fee - $0.10 USDC on Base",
  });
}

/**
 * Build 402 for read access (price set by agent, split 90/10)
 */
export function buildReadPaymentRequired(postId: string, priceUsdc: string, payoutAddress: string): Response {
  // Reader pays full price. The split is handled server-side after verification.
  return buildPaymentRequired({
    amount: priceUsdc,
    recipient: payoutAddress, // publication payout address
    memo: `read_access:${postId}`,
    description: `Unlock post - $${priceUsdc} USDC on Base`,
  });
}

/**
 * Extract payment proof from request headers
 */
export function extractPaymentProof(req: Request): PaymentSignature | null {
  const txRef = req.headers.get("X-Payment-Response") || req.headers.get("x-payment-response");
  const payerAddress = req.headers.get("X-Payer-Address") || req.headers.get("x-payer-address");

  if (!txRef) return null;

  return {
    txRef,
    payerAddress: payerAddress || "",
    chain: "base",
  };
}

/**
 * Verify a payment signature/transaction reference.
 *
 * In production, this would:
 * 1. Query Base chain RPC for the transaction
 * 2. Verify it's a USDC transfer
 * 3. Verify amount matches expected
 * 4. Verify recipient matches expected
 * 5. Verify transaction is confirmed (sufficient block confirmations)
 *
 * For MVP, we accept the txRef and do basic validation.
 * A production implementation would use ethers to query the chain.
 */
export async function verifyPayment(params: {
  txRef: string;
  expectedAmount: string;
  expectedRecipient: string;
  memo: string;
}): Promise<{ valid: boolean; error?: string }> {
  // Basic validation
  if (!params.txRef || params.txRef.length < 10) {
    return { valid: false, error: "Invalid transaction reference" };
  }

  // In production: query Base chain, verify USDC transfer details
  // For now, we trust the txRef as proof of payment
  // TODO: Implement on-chain verification via ethers provider
  //
  // const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  // const tx = await provider.getTransactionReceipt(params.txRef);
  // ... verify transfer event logs match expected amount/recipient

  return { valid: true };
}

/**
 * Calculate the platform fee split for a read payment
 * Returns { creatorAmount, platformAmount } both as string decimals
 */
export function calculateReadFeeSplit(totalUsdc: string): {
  creatorAmount: string;
  platformAmount: string;
} {
  const total = parseFloat(totalUsdc);
  const platformAmount = total * (PLATFORM_FEE_PERCENT / 100);
  const creatorAmount = total - platformAmount;

  return {
    creatorAmount: creatorAmount.toFixed(2),
    platformAmount: platformAmount.toFixed(2),
  };
}

/**
 * Convert USDC decimal string to on-chain units (6 decimals)
 */
export function usdcToUnits(amount: string): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0]) * BigInt(10 ** USDC_DECIMALS);
  if (parts[1]) {
    const decimals = parts[1].padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
    return whole + BigInt(decimals);
  }
  return whole;
}

/**
 * Convert on-chain USDC units to decimal string
 */
export function unitsToUsdc(units: bigint): string {
  const str = units.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = str.slice(0, -USDC_DECIMALS);
  const frac = str.slice(-USDC_DECIMALS);
  return `${whole}.${frac}`;
}
