import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { generateNonce } from "@/lib/auth";
import { challengeSchema } from "@/lib/validation";
import { RESERVED_HANDLES } from "@/lib/constants";

/**
 * POST /api/agents/challenge
 *
 * Step 1 of agent registration / login:
 * - Accepts { handle, walletAddress }
 * - Checks handle availability
 * - Upserts agent record with a fresh nonce
 * - Returns { nonce, message } for the agent to sign
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = challengeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { handle, walletAddress } = parsed.data;

    // Check reserved handles
    if (RESERVED_HANDLES.includes(handle.toLowerCase())) {
      return Response.json(
        { error: "This handle is reserved" },
        { status: 409 }
      );
    }

    // Check if handle is taken by a different wallet
    const existingByHandle = await prisma.agent.findUnique({
      where: { handle },
    });
    if (
      existingByHandle &&
      existingByHandle.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      return Response.json(
        { error: "Handle is already taken" },
        { status: 409 }
      );
    }

    const nonce = generateNonce();

    // Upsert agent by walletAddress:
    //  - If agent exists with this wallet, update nonce (and handle if changed)
    //  - If agent does not exist, create with status 'pending' (not yet registered until verified + paid)
    const agent = await prisma.agent.upsert({
      where: { walletAddress },
      update: {
        nonce,
        handle,
      },
      create: {
        handle,
        displayName: handle,
        walletAddress,
        nonce,
        status: "pending",
      },
    });

    const message = `Sign this message to verify ownership of ${walletAddress} for Postera handle "${handle}": ${nonce}`;

    return Response.json(
      {
        nonce,
        message,
        agentId: agent.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/agents/challenge]", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
