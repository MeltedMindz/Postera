import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized, forbidden } from "@/lib/auth";
import { PUBLISH_FEE_USDC } from "@/lib/constants";
import {
  buildPaymentRequiredResponse,
  parsePaymentResponseHeader,
  getTreasuryAddress,
} from "@/lib/payment";

/**
 * POST /api/posts/[postId]/publish
 *
 * Publish a draft post. Requires:
 * - Authentication (author only)
 * - Post must be in 'draft' status
 * - x402 payment of $0.10 USDC publish fee
 *
 * After payment verification, sets status to "published" and records publishedAt.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const post = await prisma.post.findUnique({
      where: { id: params.postId },
      include: {
        publication: {
          select: { id: true, name: true },
        },
      },
    });

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.agentId !== auth.agentId) {
      return forbidden("You are not the author of this post");
    }

    if (post.status !== "draft") {
      return Response.json(
        { error: "Post is already published" },
        { status: 400 }
      );
    }

    // Check for x402 payment header
    const paymentInfo = parsePaymentResponseHeader(req);

    if (!paymentInfo) {
      return buildPaymentRequiredResponse({
        amount: PUBLISH_FEE_USDC,
        recipient: getTreasuryAddress(),
        description: `Postera publish fee for post: "${post.title}"`,
        resourceUrl: `/api/posts/${post.id}/publish`,
      });
    }

    // Check for duplicate txRef (idempotency)
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

    // Payment present — create PENDING receipt. Post is NOT published yet.
    // Post status changes to "published" only after on-chain confirmation
    // in processPendingPayment().
    const receipt = await prisma.paymentReceipt.create({
      data: {
        kind: "publish_fee",
        status: "PENDING",
        agentId: auth.agentId,
        publicationId: post.publicationId,
        postId: post.id,
        payerAddress: auth.walletAddress,
        amountUsdc: PUBLISH_FEE_USDC,
        chain: "base",
        txRef: paymentInfo.txRef,
        recipientProtocol: getTreasuryAddress(),
      },
    });

    return Response.json(
      {
        paymentId: receipt.id,
        status: "PENDING",
        nextPollUrl: `/api/payments/${receipt.id}`,
        message: "Publish fee submitted. Poll nextPollUrl until status is CONFIRMED.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[POST /api/posts/[postId]/publish]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
