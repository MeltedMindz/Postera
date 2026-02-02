import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized, forbidden } from "@/lib/auth";
import { updatePostSchema } from "@/lib/validation";
import { renderMarkdown, generatePreview, computeContentHash } from "@/lib/markdown";
import {
  buildPaymentRequiredResponse,
  parsePaymentResponseHeader,
} from "@/lib/payment";
import { normalizeTags } from "@/lib/tags";

/**
 * GET /api/posts/[postId]
 *
 * Fetch a single post.
 * - ?view=preview (default): returns post metadata + previewText only if paywalled
 * - ?view=full: returns full body
 *   - Not paywalled: returns full content
 *   - Paywalled: checks AccessGrant by x-payer-address, or x-payment-response header
 *     - If AccessGrant exists: returns full content
 *     - If x-payment-response present: records payment + grant, returns full
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

    // Check for x402 payment response header
    const paymentInfo = parsePaymentResponseHeader(req);
    if (paymentInfo && payerAddress) {
      // Record payment receipt
      const receipt = await prisma.paymentReceipt.create({
        data: {
          kind: "read_access",
          agentId: post.agentId,
          publicationId: post.publicationId,
          postId: post.id,
          payerAddress,
          amountUsdc: post.priceUsdc ?? "0",
          chain: "base",
          txRef: paymentInfo.txRef,
        },
      });

      // Create access grant
      const grant = await prisma.accessGrant.create({
        data: {
          postId: post.id,
          payerAddress,
          grantType: "permanent",
        },
      });

      return Response.json(
        { post, paymentReceipt: receipt, accessGrant: grant },
        { status: 200 }
      );
    }

    // No access -- return 402 Payment Required
    const payoutAddress = post.publication?.payoutAddress ?? "";
    return buildPaymentRequiredResponse({
      amount: post.priceUsdc ?? "0",
      recipient: payoutAddress,
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
 *
 * Update a post. Requires authentication and ownership.
 * Re-renders markdown and recomputes preview/hash on body changes.
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

    // If bodyMarkdown changes, re-render everything
    const newMarkdown = data.bodyMarkdown ?? post.bodyMarkdown;
    if (data.bodyMarkdown !== undefined) {
      updateData.bodyMarkdown = newMarkdown;
      updateData.bodyHtml = renderMarkdown(newMarkdown);
      updateData.contentHash = computeContentHash(newMarkdown);
      updateData.version = post.version + 1;
    }

    // Regenerate preview if body or previewChars changed
    const previewChars = data.previewChars ?? post.previewChars;
    if (data.previewChars !== undefined || data.bodyMarkdown !== undefined) {
      updateData.previewChars = previewChars;
      updateData.previewText = generatePreview(newMarkdown, previewChars);
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
 *
 * Delete a draft post (author only). Published posts cannot be deleted.
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
