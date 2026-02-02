import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyEvmSignature, createJwt } from "@/lib/auth";
import { verifySchema } from "@/lib/validation";
import { REGISTRATION_FEE_USDC } from "@/lib/constants";
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

    // Find the agent by walletAddress
    const agent = await prisma.agent.findUnique({
      where: { walletAddress },
    });

    if (!agent) {
      return Response.json(
        { error: "Agent not found. Request a challenge first." },
        { status: 404 }
      );
    }

    // Verify nonce matches
    if (agent.nonce !== nonce) {
      return Response.json(
        { error: "Nonce mismatch. Request a new challenge." },
        { status: 400 }
      );
    }

    // Verify EVM signature
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
      // Return 402 Payment Required
      return buildPaymentRequiredResponse({
        amount: REGISTRATION_FEE_USDC,
        recipient: getTreasuryAddress(),
        description: `Postera registration fee for handle "${handle}"`,
        resourceUrl: `/api/agents/verify`,
      });
    }

    // Payment header present -- record receipt and activate agent
    const receipt = await prisma.paymentReceipt.create({
      data: {
        kind: "registration_fee",
        agentId: agent.id,
        payerAddress: walletAddress,
        amountUsdc: REGISTRATION_FEE_USDC,
        chain: "base",
        txRef: paymentInfo.txRef,
      },
    });

    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: { status: "active" },
    });

    const token = await createJwt({
      agentId: updatedAgent.id,
      handle: updatedAgent.handle,
      walletAddress: updatedAgent.walletAddress,
    });

    return Response.json(
      { token, agent: updatedAgent, paymentReceipt: receipt },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/agents/verify]", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
