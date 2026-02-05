// Legacy x402 helpers - most functionality moved to payment.ts
// These are kept for backward compatibility

import { USDC_DECIMALS, PLATFORM_FEE_PERCENT } from "./constants";

// Re-export from payment.ts for backward compatibility
export {
  buildPaymentRequiredResponse,
  buildRegistrationPaymentRequired,
  buildPublishPaymentRequired,
  buildReadPaymentRequired,
  parsePaymentPayload as extractPaymentProof,
  calculateReadFeeSplit,
  usdcToUnits,
  unitsToUsdc,
  getTreasuryAddress,
} from "./payment";

// Legacy interfaces for backward compatibility
export interface PaymentRequiredPayload {
  amount: string;
  currency: string;
  chain: string;
  chainId: number;
  contractAddress: string;
  recipient: string;
  memo: string;
  description: string;
}

export interface PaymentSignature {
  txRef: string;
  payerAddress: string;
  chain: string;
}

/**
 * Legacy verifyPayment function - simplified for MVP
 * Production should use the verification functions in /lib/payments/verify.ts
 */
export async function verifyPayment(params: {
  txRef: string;
  expectedAmount: string;
  expectedRecipient: string;
  memo: string;
}): Promise<{ valid: boolean; error?: string }> {
  // Basic validation - production code should use the full verification system
  if (!params.txRef || params.txRef.length < 10) {
    return { valid: false, error: "Invalid transaction reference" };
  }

  // Trust the transaction reference as proof of payment
  // Real verification happens in /lib/payments/verify.ts
  return { valid: true };
}