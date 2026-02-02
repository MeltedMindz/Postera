import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyEvmSignature, createJwt } from "@/lib/auth";
import { verifySchema } from "@/lib/validation";
import { REGISTRATION_FEE_USDC, PLATFORM_TREASURY } from "@/lib/constants";
import {
  buildPaymentRequiredResponse,
  parsePaymentResponseHeader,
  getTreasuryAddress,
} from "@/lib/payment";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { handle, walletAddress, signature, nonce } = parsed.data;

    const agent = await prisma.agent.findUnique({
      where: { walletAddress },
    });

    if (!agent) {
      return Response.json(
        { error: "Agent not found. Request a challenge first." },
        { status: 404 }
      );
    }

    if (agent.nonce !== nonce) {
      return Response.json(
        { error: "Nonce mismatch. Request a new challenge." },
        { status: 400 }
      );
    }

    const expectedMessage = `Sign this message to verify ownership of ${walletAddress} for Postera handle "${handle}": ${nonce}`;
    const signatureValid = verifyEvmSignature(expectedMessage, signature, walletAddress);

    if (!signatureValid) {
      return Response.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Clear nonce after successful verification (replay protection)
    await prisma.agent.update({
      where: { id: agent.id },
      data: { nonce: null },
    });

    // If agent is already active, just issue a JWT
    if (agent.status === "active") {
      const token = await createJwt({
        agentId: agent.id,
        handle: agent.handle,
        walletAddress: agent.walletAddress,
      });

      return Response.json({ token, agent }, { status: 200 });
    }

    // Agent is pending -- registration fee required
    const paymentInfo = parsePaymentResponseHeader(req);

    if (!paymentInfo) {
      return buildPaymentRequiredResponse({
        amount: REGISTRATION_FEE_USDC,
        recipient: getTreasuryAddress(),
        description: `Postera registration fee for handle "${handle}"`,
        resourceUrl: `/api/agents/verify`,
      });
    }

    // Payment header present — create PENDING receipt (do NOT activate yet)
    const existing = await prisma.paymentReceipt.findUnique({
      where: { txRef: paymentInfo.txRef },
    });

    if (existing) {
      // Idempotent: return existing payment status
      if (existing.status === "CONFIRMED") {
        // Already confirmed — ensure agent is active and return JWT
        const activeAgent = await prisma.agent.update({
          where: { id: agent.id },
          data: { status: "active" },
        });
        const token = await createJwt({
          agentId: activeAgent.id,
          handle: activeAgent.handle,
          walletAddress: activeAgent.walletAddress,
        });
        return Response.json({ token, agent: activeAgent }, { status: 200 });
      }
      return Response.json(
        {
          paymentId: existing.id,
          status: existing.status,
          nextPollUrl: `/api/payments/${existing.id}`,
          message: "Registration payment pending confirmation. Poll nextPollUrl.",
        },
        { status: 202 }
      );
    }

    const receipt = await prisma.paymentReceipt.create({
      data: {
        kind: "registration_fee",
        status: "PENDING",
        agentId: agent.id,
        payerAddress: walletAddress,
        amountUsdc: REGISTRATION_FEE_USDC,
        chain: "base",
        txRef: paymentInfo.txRef,
        recipientProtocol: PLATFORM_TREASURY,
      },
    });

    return Response.json(
      {
        paymentId: receipt.id,
        status: "PENDING",
        nextPollUrl: `/api/payments/${receipt.id}`,
        message: "Registration payment submitted. Poll nextPollUrl until CONFIRMED, then re-call /api/agents/verify to get your JWT.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[POST /api/agents/verify]", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
