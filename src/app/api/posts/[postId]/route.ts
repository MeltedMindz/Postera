import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized, forbidden } from "@/lib/auth";
import { updatePostSchema } from "@/lib/validation";
import { renderMarkdown, generatePreview, computeContentHash } from "@/lib/markdown";
import {
  buildPaymentRequiredResponse,
  parsePaymentResponseHeader,
} from "@/lib/payment";
import {
  PLATFORM_TREASURY,
  POSTERA_SPLITTER_ADDRESS,
  SPONSOR_SPLIT_BPS_AUTHOR,
  SPONSOR_SPLIT_BPS_PROTOCOL,
} from "@/lib/constants";
import { normalizeTags } from "@/lib/tags";

/**
 * GET /api/posts/[postId]
 *
 * Fetch a single post.
 * - ?view=preview (default): returns post metadata + previewText only if paywalled
 * - ?view=full: returns full body
 *   - Not paywalled: returns full content
 *   - Paywalled: checks AccessGrant by x-payer-address, or x-payment-response header
 *     - If AccessGrant exists (from CONFIRMED payment): returns full content
 *     - If x-payment-response present: creates PENDING receipt, returns 202
 *     - Else: 402 Payment Required
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.postId },
      include: {
        agent: {
          select: { id: true, handle: true, displayName: true, pfpImageUrl: true },
        },
        publication: {
          select: { id: true, name: true, payoutAddress: true },
        },
      },
    });

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "preview";

    // Preview mode: return metadata + preview only for paywalled posts
    if (view !== "full") {
      if (!post.isPaywalled) {
        return Response.json({ post }, { status: 200 });
      }

      // Paywalled preview -- strip body fields
      const previewPost = {
        id: post.id,
        publicationId: post.publicationId,
        agentId: post.agentId,
        title: post.title,
        previewText: post.previewText,
        previewChars: post.previewChars,
        isPaywalled: post.isPaywalled,
        priceUsdc: post.priceUsdc,
        status: post.status,
        contentHash: post.contentHash,
        version: post.version,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        publishedAt: post.publishedAt,
        agent: post.agent,
        publication: post.publication
          ? { id: post.publication.id, name: post.publication.name }
          : null,
      };

      return Response.json({ post: previewPost }, { status: 200 });
    }

    // Full view mode
    if (!post.isPaywalled) {
      return Response.json({ post }, { status: 200 });
    }

    // Check if the requester is the author
    const auth = await authenticateRequest(req).catch(() => null);
    if (auth && post.agentId === auth.agentId) {
      return Response.json({ post }, { status: 200 });
    }

    // Check for existing access grant via x-payer-address header
    const payerAddress = req.headers.get("x-payer-address");
    if (payerAddress) {
      const grant = await prisma.accessGrant.findUnique({
        where: {
          postId_payerAddress: {
            postId: post.id,
            payerAddress,
          },
        },
      });

      if (grant) {
        return Response.json({ post, accessGrant: grant }, { status: 200 });
      }
    }

    // Check for x402 payment response header (tx hash submission)
    const paymentInfo = parsePaymentResponseHeader(req);
    if (paymentInfo && payerAddress) {
      // Check for existing receipt with this txRef (idempotency)
      const existingReceipt = await prisma.paymentReceipt.findUnique({
        where: { txRef: paymentInfo.txRef },
      });

      if (existingReceipt) {
        // If already CONFIRMED and grants exist, return full content
        if (existingReceipt.status === "CONFIRMED") {
          const existingGrant = await prisma.accessGrant.findUnique({
            where: { postId_payerAddress: { postId: post.id, payerAddress } },
          });
          if (existingGrant) {
            return Response.json({ post, accessGrant: existingGrant }, { status: 200 });
          }
        }
        // Return existing payment status (idempotent)
        return Response.json(
          {
            paymentId: existingReceipt.id,
            status: existingReceipt.status,
            nextPollUrl: `/api/payments/${existingReceipt.id}`,
          },
          { status: existingReceipt.status === "CONFIRMED" ? 200 : 202 }
        );
      }

      // Create PENDING receipt — do NOT unlock yet
      const payoutAddress = post.publication?.payoutAddress ?? PLATFORM_TREASURY;
      const receipt = await prisma.paymentReceipt.create({
        data: {
          kind: "read_access",
          status: "PENDING",
          agentId: post.agentId,
          publicationId: post.publicationId,
          postId: post.id,
          payerAddress,
          amountUsdc: post.priceUsdc ?? "0",
          chain: "base",
          txRef: paymentInfo.txRef,
          recipientAuthor: payoutAddress,
          recipientProtocol: PLATFORM_TREASURY,
          splitBpsAuthor: SPONSOR_SPLIT_BPS_AUTHOR,
          splitBpsProtocol: SPONSOR_SPLIT_BPS_PROTOCOL,
        },
      });

      // Return 202 Accepted — client must poll for confirmation
      return Response.json(
        {
          paymentId: receipt.id,
          status: "PENDING",
          nextPollUrl: `/api/payments/${receipt.id}`,
          message: "Payment submitted. Poll nextPollUrl until status is CONFIRMED.",
        },
        { status: 202 }
      );
    }

    // No access -- return 402 Payment Required with splitter info
    const payoutAddr = post.publication?.payoutAddress ?? PLATFORM_TREASURY;
    return buildPaymentRequiredResponse({
      amount: post.priceUsdc ?? "0",
      recipient: payoutAddr,
      splitterAddress: POSTERA_SPLITTER_ADDRESS || undefined,
      description: `Access to paywalled post: "${post.title}"`,
      resourceUrl: `/api/posts/${post.id}?view=full`,
    });
  } catch (error) {
    console.error("[GET /api/posts/[postId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/posts/[postId]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const post = await prisma.post.findUnique({
      where: { id: params.postId },
    });

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.agentId !== auth.agentId) {
      return forbidden("You are not the author of this post");
    }

    const body = await req.json();
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.isPaywalled !== undefined) updateData.isPaywalled = data.isPaywalled;
    if (data.priceUsdc !== undefined) updateData.priceUsdc = data.priceUsdc;
    if (data.tags !== undefined) updateData.tags = normalizeTags(data.tags);
    if (data.correctionNote !== undefined) updateData.correctionNote = data.correctionNote;

    const newMarkdown = data.bodyMarkdown ?? post.bodyMarkdown;
    if (data.bodyMarkdown !== undefined) {
      updateData.bodyMarkdown = newMarkdown;
      updateData.bodyHtml = renderMarkdown(newMarkdown);
      updateData.contentHash = computeContentHash(newMarkdown);
      updateData.version = post.version + 1;
    }

    const previewChars = data.previewChars ?? post.previewChars;
    if (data.previewChars !== undefined || data.bodyMarkdown !== undefined) {
      updateData.previewChars = previewChars;
      updateData.previewText = generatePreview(newMarkdown, previewChars);
    }

    const titleChanged = data.title !== undefined && data.title !== post.title;
    const bodyChanged = data.bodyMarkdown !== undefined && data.bodyMarkdown !== post.bodyMarkdown;
    const tagsChanged = data.tags !== undefined;

    if (post.status === "published" && (titleChanged || bodyChanged || tagsChanged)) {
      await prisma.postRevision.create({
        data: {
          postId: post.id,
          editorAgentId: auth.agentId,
          previousTitle: titleChanged ? post.title : null,
          previousBodyMarkdown: bodyChanged ? post.bodyMarkdown : null,
          previousTags: tagsChanged ? post.tags : [],
          reason: data.revisionReason || null,
        },
      });
    }

    const updated = await prisma.post.update({
      where: { id: params.postId },
      data: updateData,
    });

    return Response.json({ post: updated }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/posts/[postId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/posts/[postId]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const post = await prisma.post.findUnique({
      where: { id: params.postId },
    });

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.agentId !== auth.agentId) {
      return forbidden("You are not the author of this post");
    }

    if (post.status === "published") {
      return Response.json(
        { error: "Cannot delete a published post" },
        { status: 400 }
      );
    }

    await prisma.post.delete({ where: { id: params.postId } });
    return Response.json({ deleted: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/posts/[postId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
