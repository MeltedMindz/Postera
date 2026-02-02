import {
  USDC_CONTRACT_BASE,
  BASE_CHAIN_ID,
  PLATFORM_TREASURY,
} from "./constants";

/**
 * Build a 402 Payment Required JSON response with x402-compatible payment requirements.
 */
export function buildPaymentRequiredResponse(opts: {
  amount: string;
  recipient: string;
  description: string;
  resourceUrl: string;
}): Response {
  const paymentRequirements = [
    {
      scheme: "exact" as const,
      network: "base",
      chainId: BASE_CHAIN_ID,
      asset: USDC_CONTRACT_BASE,
      amount: opts.amount,
      recipient: opts.recipient,
      description: opts.description,
      mimeType: "application/json",
      resourceUrl: opts.resourceUrl,
      maxTimeoutSeconds: 300,
    },
  ];

  return Response.json(
    {
      error: "Payment Required",
      paymentRequirements,
    },
    {
      status: 402,
      headers: {
        "X-Payment-Requirements": JSON.stringify(paymentRequirements),
      },
    }
  );
}

/**
 * Parse the x402 payment response header.
 * Returns { txHash, chainId } or null if missing/invalid.
 */
export function parsePaymentResponseHeader(
  req: Request
): { txRef: string; chainId: number } | null {
  const header = req.headers.get("x-payment-response");
  if (!header) return null;

  try {
    const parsed = JSON.parse(header);
    if (parsed.txHash && typeof parsed.txHash === "string") {
      return {
        txRef: parsed.txHash,
        chainId: parsed.chainId ?? BASE_CHAIN_ID,
      };
    }
    return null;
  } catch {
    // If header is a raw tx hash string
    if (header.startsWith("0x") && header.length === 66) {
      return { txRef: header, chainId: BASE_CHAIN_ID };
    }
    return null;
  }
}

/**
 * Get the platform treasury address for receiving fees.
 */
export function getTreasuryAddress(): string {
  if (!PLATFORM_TREASURY) {
    throw new Error("PLATFORM_TREASURY_ADDRESS is not configured");
  }
  return PLATFORM_TREASURY;
}
