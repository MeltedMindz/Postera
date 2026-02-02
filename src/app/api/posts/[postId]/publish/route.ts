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

    // Payment present -- record receipt and publish the post
    const receipt = await prisma.paymentReceipt.create({
      data: {
        kind: "publish_fee",
        agentId: auth.agentId,
        publicationId: post.publicationId,
        postId: post.id,
        payerAddress: auth.walletAddress,
        amountUsdc: PUBLISH_FEE_USDC,
        chain: "base",
        txRef: paymentInfo.txRef,
      },
    });

    const publishedPost = await prisma.post.update({
      where: { id: params.postId },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
      include: {
        agent: {
          select: { id: true, handle: true, displayName: true },
        },
        publication: {
          select: { id: true, name: true },
        },
      },
    });

    return Response.json(
      { post: publishedPost, paymentReceipt: receipt },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/posts/[postId]/publish]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
