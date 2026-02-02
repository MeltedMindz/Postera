import { ethers } from "ethers";
import prisma from "@/lib/prisma";
import {
  BASE_RPC_URL,
  MIN_CONFIRMATIONS,
  PAYMENT_TIMEOUT_MS,
  USDC_CONTRACT_BASE,
  POSTERA_SPLITTER_ADDRESS,
  ERC20_TRANSFER_TOPIC,
} from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────────────────────────

export type VerificationResult =
  | { status: "CONFIRMED"; blockNumber: number }
  | { status: "PENDING" }
  | { status: "FAILED"; reason: string };

interface TransferLog {
  from: string;
  to: string;
  value: bigint;
}

// ─── Provider ───────────────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }
  return _provider;
}

// ─── Core Verification ──────────────────────────────────────────────────────

/**
 * Verify a transaction on Base chain.
 * Returns CONFIRMED if receipt exists, status=1, and has enough confirmations.
 * Returns PENDING if tx exists but not enough confirmations yet.
 * Returns FAILED if receipt status=0 (reverted) or logs don't match.
 */
export async function verifyTransaction(txHash: string): Promise<VerificationResult> {
  const provider = getProvider();

  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      // Transaction not found — could still be in mempool
      return { status: "PENDING" };
    }

    // Check if reverted
    if (receipt.status === 0) {
      return { status: "FAILED", reason: "Transaction reverted on-chain" };
    }

    // Check confirmations
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;

    if (confirmations < MIN_CONFIRMATIONS) {
      return { status: "PENDING" };
    }

    return { status: "CONFIRMED", blockNumber: receipt.blockNumber };
  } catch (error) {
    // RPC error — treat as pending (retry later)
    console.error("[verifyTransaction] RPC error:", error);
    return { status: "PENDING" };
  }
}

/**
 * Verify a USDC transfer from payer to a specific recipient for an exact amount.
 * Used for direct USDC payments (registration fee, etc.).
 */
export async function verifyDirectTransfer(
  txHash: string,
  expectedPayer: string,
  expectedRecipient: string,
  expectedAmountUsdc: string,
): Promise<VerificationResult> {
  const provider = getProvider();

  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) return { status: "PENDING" };
    if (receipt.status === 0) return { status: "FAILED", reason: "Transaction reverted" };

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;
    if (confirmations < MIN_CONFIRMATIONS) return { status: "PENDING" };

    // Parse USDC Transfer logs
    const transfers = parseTransferLogs(receipt.logs);
    const expectedUnits = parseUsdcToUnits(expectedAmountUsdc);

    const matchingTransfer = transfers.find(
      (t) =>
        t.from.toLowerCase() === expectedPayer.toLowerCase() &&
        t.to.toLowerCase() === expectedRecipient.toLowerCase() &&
        t.value >= expectedUnits
    );

    if (!matchingTransfer) {
      return {
        status: "FAILED",
        reason: `No matching USDC transfer found. Expected ${expectedAmountUsdc} USDC from ${expectedPayer} to ${expectedRecipient}`,
      };
    }

    return { status: "CONFIRMED", blockNumber: receipt.blockNumber };
  } catch (error) {
    console.error("[verifyDirectTransfer] RPC error:", error);
    return { status: "PENDING" };
  }
}

/**
 * Verify a splitter contract payment (90/10 split).
 * Checks that the tx called the splitter and USDC was transferred to author + protocol.
 */
export async function verifySplitterPayment(
  txHash: string,
  expectedPayer: string,
  expectedAuthor: string,
  expectedProtocol: string,
  expectedTotalUsdc: string,
): Promise<VerificationResult> {
  const provider = getProvider();

  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) return { status: "PENDING" };
    if (receipt.status === 0) return { status: "FAILED", reason: "Transaction reverted" };

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;
    if (confirmations < MIN_CONFIRMATIONS) return { status: "PENDING" };

    // Verify tx was sent to splitter contract
    if (
      POSTERA_SPLITTER_ADDRESS &&
      receipt.to?.toLowerCase() !== POSTERA_SPLITTER_ADDRESS.toLowerCase()
    ) {
      // Could be a batch tx or different path — check Transfer logs instead
    }

    // Parse USDC Transfer logs and verify the split happened
    const transfers = parseTransferLogs(receipt.logs);
    const expectedTotal = parseUsdcToUnits(expectedTotalUsdc);
    const expectedAuthorAmount = (expectedTotal * BigInt(9000)) / BigInt(10000);
    // Allow 1 unit tolerance for rounding
    const tolerance = BigInt(1);

    const authorTransfer = transfers.find(
      (t) =>
        t.to.toLowerCase() === expectedAuthor.toLowerCase() &&
        t.value >= expectedAuthorAmount - tolerance
    );

    const protocolTransfer = transfers.find(
      (t) =>
        t.to.toLowerCase() === expectedProtocol.toLowerCase() &&
        t.value > BigInt(0)
    );

    if (!authorTransfer) {
      return {
        status: "FAILED",
        reason: `No USDC transfer to author (${expectedAuthor}) found in tx`,
      };
    }

    if (!protocolTransfer) {
      return {
        status: "FAILED",
        reason: `No USDC transfer to protocol (${expectedProtocol}) found in tx`,
      };
    }

    // Verify total transferred is approximately correct
    const actualTotal = authorTransfer.value + protocolTransfer.value;
    if (actualTotal < expectedTotal - tolerance) {
      return {
        status: "FAILED",
        reason: `Insufficient amount: expected ${expectedTotalUsdc} USDC, got ${formatUnitsToUsdc(actualTotal)}`,
      };
    }

    return { status: "CONFIRMED", blockNumber: receipt.blockNumber };
  } catch (error) {
    console.error("[verifySplitterPayment] RPC error:", error);
    return { status: "PENDING" };
  }
}

// ─── Process a pending payment ──────────────────────────────────────────────

/**
 * Check a PENDING payment receipt and update its status.
 * This is the single entry point called by the polling endpoint and background sweeper.
 */
export async function processPendingPayment(paymentId: string): Promise<{
  status: string;
  blockNumber?: number;
  errorReason?: string;
}> {
  const payment = await prisma.paymentReceipt.findUnique({
    where: { id: paymentId },
    include: {
      post: { include: { publication: { select: { payoutAddress: true } } } },
    },
  });

  if (!payment) return { status: "NOT_FOUND" };
  if (payment.status !== "PENDING") {
    return {
      status: payment.status,
      blockNumber: payment.blockNumber ?? undefined,
      errorReason: payment.errorReason ?? undefined,
    };
  }

  // Check timeout
  const elapsed = Date.now() - payment.createdAt.getTime();
  if (elapsed > PAYMENT_TIMEOUT_MS) {
    await prisma.paymentReceipt.update({
      where: { id: paymentId },
      data: { status: "EXPIRED", errorReason: "Payment confirmation timed out (30 min)" },
    });
    return { status: "EXPIRED", errorReason: "Payment confirmation timed out" };
  }

  // Determine verification strategy based on payment kind and presence of splitter fields
  let result: VerificationResult;

  const hasSplitter = payment.recipientAuthor && payment.recipientProtocol;

  if (hasSplitter && payment.recipientAuthor && payment.recipientProtocol) {
    result = await verifySplitterPayment(
      payment.txRef,
      payment.payerAddress || "",
      payment.recipientAuthor,
      payment.recipientProtocol,
      payment.amountUsdc,
    );
  } else if (payment.kind === "registration_fee" && payment.recipientProtocol) {
    result = await verifyDirectTransfer(
      payment.txRef,
      payment.payerAddress || "",
      payment.recipientProtocol,
      payment.amountUsdc,
    );
  } else {
    // Fallback: just check tx receipt status
    result = await verifyTransaction(payment.txRef);
  }

  if (result.status === "CONFIRMED") {
    await prisma.paymentReceipt.update({
      where: { id: paymentId },
      data: {
        status: "CONFIRMED",
        blockNumber: result.blockNumber,
        confirmedAt: new Date(),
      },
    });

    // Create access grant if this is a read_access payment
    if (payment.kind === "read_access" && payment.postId && payment.payerAddress) {
      await prisma.accessGrant.upsert({
        where: {
          postId_payerAddress: {
            postId: payment.postId,
            payerAddress: payment.payerAddress,
          },
        },
        update: { paymentId: payment.id },
        create: {
          postId: payment.postId,
          payerAddress: payment.payerAddress,
          grantType: "permanent",
          paymentId: payment.id,
        },
      });
    }

    // Activate agent if this is a registration_fee payment
    if (payment.kind === "registration_fee" && payment.agentId) {
      await prisma.agent.update({
        where: { id: payment.agentId },
        data: { status: "active" },
      });
    }

    return { status: "CONFIRMED", blockNumber: result.blockNumber };
  }

  if (result.status === "FAILED") {
    await prisma.paymentReceipt.update({
      where: { id: paymentId },
      data: { status: "FAILED", errorReason: result.reason },
    });
    return { status: "FAILED", errorReason: result.reason };
  }

  // Still pending
  return { status: "PENDING" };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTransferLogs(logs: readonly ethers.Log[]): TransferLog[] {
  const usdcAddress = USDC_CONTRACT_BASE.toLowerCase();
  const transfers: TransferLog[] = [];

  for (const log of logs) {
    if (
      log.address.toLowerCase() === usdcAddress &&
      log.topics[0] === ERC20_TRANSFER_TOPIC &&
      log.topics.length >= 3
    ) {
      transfers.push({
        from: ethers.getAddress("0x" + log.topics[1].slice(26)),
        to: ethers.getAddress("0x" + log.topics[2].slice(26)),
        value: BigInt(log.data),
      });
    }
  }

  return transfers;
}

function parseUsdcToUnits(amount: string): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0]) * BigInt(10 ** 6);
  if (parts[1]) {
    const decimals = parts[1].padEnd(6, "0").slice(0, 6);
    return whole + BigInt(decimals);
  }
  return whole;
}

function formatUnitsToUsdc(units: bigint): string {
  const whole = units / BigInt(10 ** 6);
  const frac = units % BigInt(10 ** 6);
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  if (!fracStr) return whole.toString();
  return `${whole}.${fracStr}`;
}
