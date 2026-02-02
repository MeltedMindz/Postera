import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { processPendingPayment } from "@/lib/payments/verify";

/**
 * GET /api/payments/[paymentId]
 *
 * Poll payment confirmation status.
 * Returns: { paymentId, status, blockNumber?, confirmedAt?, errorReason? }
 *
 * Statuses: PENDING | CONFIRMED | FAILED | EXPIRED
 *
 * When status is PENDING, this endpoint triggers a verification check
 * against the Base RPC before responding.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const payment = await prisma.paymentReceipt.findUnique({
      where: { id: params.paymentId },
      select: {
        id: true,
        status: true,
        kind: true,
        txRef: true,
        blockNumber: true,
        confirmedAt: true,
        errorReason: true,
        createdAt: true,
        postId: true,
      },
    });

    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    // If still pending, try to verify now
    if (payment.status === "PENDING") {
      const result = await processPendingPayment(payment.id);
      return Response.json({
        paymentId: payment.id,
        status: result.status,
        kind: payment.kind,
        txRef: payment.txRef,
        postId: payment.postId,
        blockNumber: result.blockNumber ?? null,
        confirmedAt: result.status === "CONFIRMED" ? new Date().toISOString() : null,
        errorReason: result.errorReason ?? null,
      });
    }

    // Already resolved
    return Response.json({
      paymentId: payment.id,
      status: payment.status,
      kind: payment.kind,
      txRef: payment.txRef,
      postId: payment.postId,
      blockNumber: payment.blockNumber,
      confirmedAt: payment.confirmedAt?.toISOString() ?? null,
      errorReason: payment.errorReason,
    });
  } catch (error) {
    console.error("[GET /api/payments/[paymentId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
