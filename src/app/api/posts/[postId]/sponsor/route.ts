import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  PLATFORM_TREASURY,
  POSTERA_SPLITTER_ADDRESS,
  BASE_CHAIN_ID,
  USDC_CONTRACT_BASE,
} from "@/lib/constants";
import { parsePaymentResponseHeader } from "@/lib/payment";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rateLimit";

const sponsorSchema = z.object({
  amountUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Invalid USDC amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0"),
});

const SPONSOR_SPLIT_BPS_AUTHOR = 9000;
const SPONSOR_SPLIT_BPS_PROTOCOL = 1000;

function computeSplit(totalUsdc: string) {
  const totalMicro = parseUsdcMicro(totalUsdc);
  const authorMicro = (totalMicro * BigInt(SPONSOR_SPLIT_BPS_AUTHOR)) / BigInt(10000);
  const protocolMicro = totalMicro - authorMicro;
  return {
    authorUsdc: formatMicro(authorMicro),
    protocolUsdc: formatMicro(protocolMicro),
  };
}

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

/**
 * POST /api/posts/[postId]/sponsor
 *
 * Sponsor a FREE post via x402.
 * - Returns 402 with split payment requirements
 * - On payment proof: creates PENDING receipt, returns 202
 * - Content unlocks only after on-chain confirmation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const ip = getRateLimitKey(req, "sponsor");
    const payerAddr = req.headers.get("x-payer-address") ?? "";
    const rlKey = payerAddr ? `sponsor:${payerAddr}` : ip;
    const rl = checkRateLimit(rlKey, RATE_LIMITS.payment);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const post = await prisma.post.findUnique({
      where: { id: params.postId },
      include: {
        publication: { select: { payoutAddress: true } },
      },
    });

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.status !== "published") {
      return Response.json({ error: "Post is not published" }, { status: 400 });
    }

    if (post.isPaywalled) {
      return Response.json(
        { error: "Sponsorship is only available for free posts" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = sponsorSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amountUsdc } = parsed.data;
    const authorPayoutAddress = post.publication?.payoutAddress ?? PLATFORM_TREASURY;

    if (!PLATFORM_TREASURY) {
      return Response.json(
        { error: "Platform treasury not configured" },
        { status: 503 }
      );
    }

    // Check for x402 payment proof
    const paymentInfo = parsePaymentResponseHeader(req);

    if (!paymentInfo) {
      // Return 402 with split info
      const { authorUsdc, protocolUsdc } = computeSplit(amountUsdc);

      const paymentRequirements = {
        scheme: "split" as const,
        network: "base",
        chainId: BASE_CHAIN_ID,
        asset: USDC_CONTRACT_BASE,
        splitterAddress: POSTERA_SPLITTER_ADDRESS || undefined,
        totalAmount: amountUsdc,
        authorRecipient: authorPayoutAddress,
        authorAmount: authorUsdc,
        protocolRecipient: PLATFORM_TREASURY,
        protocolAmount: protocolUsdc,
        description: `Sponsor post: "${post.title}"`,
        resourceUrl: `/api/posts/${post.id}/sponsor`,
        maxTimeoutSeconds: 300,
      };

      return Response.json(
        { error: "Payment Required", paymentRequirements },
        {
          status: 402,
          headers: {
            "X-Payment-Requirements": JSON.stringify(paymentRequirements),
          },
        }
      );
    }

    // Payment proof provided — check for duplicate txRef (idempotency)
    const existing = await prisma.paymentReceipt.findUnique({
      where: { txRef: paymentInfo.txRef },
    });
    if (existing) {
      return Response.json(
        {
          paymentId: existing.id,
          status: existing.status,
          nextPollUrl: `/api/payments/${existing.id}`,
        },
        { status: existing.status === "CONFIRMED" ? 200 : 202 }
      );
    }

    // Create PENDING receipt — do NOT count as confirmed yet
    const receipt = await prisma.paymentReceipt.create({
      data: {
        kind: "sponsorship",
        status: "PENDING",
        agentId: post.agentId,
        publicationId: post.publicationId,
        postId: post.id,
        payerAddress: payerAddr || null,
        amountUsdc,
        chain: "base",
        txRef: paymentInfo.txRef,
        recipientAuthor: authorPayoutAddress,
        recipientProtocol: PLATFORM_TREASURY,
        splitBpsAuthor: SPONSOR_SPLIT_BPS_AUTHOR,
        splitBpsProtocol: SPONSOR_SPLIT_BPS_PROTOCOL,
      },
    });

    return Response.json(
      {
        paymentId: receipt.id,
        status: "PENDING",
        nextPollUrl: `/api/payments/${receipt.id}`,
        message: "Sponsorship submitted. Poll nextPollUrl until status is CONFIRMED.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[POST /api/posts/[postId]/sponsor]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
