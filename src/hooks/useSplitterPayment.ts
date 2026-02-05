"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { useWriteContracts, useCallsStatus } from "wagmi/experimental";
import { base } from "wagmi/chains";

// ─── Constants ──────────────────────────────────────────────────────────────

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const SPLITTER_ADDRESS = "0x622C9f74fA66D4d7E0661F1fd541Cc72E367c938" as const;
const BASE_CHAIN_ID = 8453;

// ─── ABIs ───────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const SPLITTER_ABI = [
  {
    name: "sponsor",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "author", type: "address" },
      { name: "total", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function usdcToUnits(amount: string): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0]) * BigInt(10 ** 6);
  if (parts[1]) {
    const decimals = parts[1].padEnd(6, "0").slice(0, 6);
    return whole + BigInt(decimals);
  }
  return whole;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type PaymentStep =
  | "idle"
  | "checking_allowance"
  | "approving"
  | "approve_confirming"
  | "sending"
  | "confirming"
  | "verifying"
  | "success"
  | "error";

export interface UseSplitterPaymentReturn {
  /** Current step in the payment flow */
  step: PaymentStep;
  /** Error message when step === "error" */
  errorMessage: string;
  /** Transaction hash of the sponsor call (available after "confirming") */
  txHash: string | undefined;
  /** Whether the approve step was skipped (allowance was sufficient) */
  approveSkipped: boolean;
  /**
   * Kick off the full approve-then-sponsor flow.
   * Pass the author wallet and the total USDC string (e.g. "1.00").
   * The hook handles allowance check, conditional approve, and the sponsor call.
   */
  execute: (author: `0x${string}`, amountUsdc: string) => void;
  /** Reset to idle so the user can retry */
  reset: () => void;
  /**
   * Submit proof to the backend after on-chain confirmation.
   * The consumer component calls this in step === "confirming" -> success
   * since the proof endpoint differs between Sponsor and Paywall.
   * Returns the backend response body, or throws.
   */
  // Proof submission is left to the consumer because the API differs.
  // The hook exposes `onConfirmed` callback registration instead.
}

interface UseSplitterPaymentOptions {
  /**
   * Called when the sponsor tx is confirmed on-chain.
   * The consumer should submit proof to the backend, then call `markSuccess()`
   * or `markError(msg)` that are passed as arguments.
   */
  onConfirmed?: (
    txHash: string,
    helpers: { markSuccess: () => void; markError: (msg: string) => void }
  ) => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useSplitterPayment(
  options: UseSplitterPaymentOptions = {}
): UseSplitterPaymentReturn {
  const { onConfirmed } = options;

  // State
  const [step, setStep] = useState<PaymentStep>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [approveSkipped, setApproveSkipped] = useState(false);

  // Payment params (set on execute, consumed by effects)
  const [author, setAuthor] = useState<`0x${string}` | null>(null);
  const [amountUnits, setAmountUnits] = useState<bigint>(BigInt(0));

  // Track whether we should use batch (EIP-5792) or sequential
  const [useBatch, setUseBatch] = useState(true);

  // Refs for tracking flow progression
  const flowActiveRef = useRef(false);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;

  const { address } = useAccount();
  const chainId = useChainId();

  // ─── 1. Allowance read ──────────────────────────────────────────────────

  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, SPLITTER_ADDRESS] : undefined,
    query: { enabled: false }, // manual
  });

  // ─── 2. Approve tx ─────────────────────────────────────────────────────

  const {
    data: approveTxHash,
    writeContract: writeApprove,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    isSuccess: approveConfirmed,
    error: approveConfirmError,
  } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // ─── 3. Sponsor tx (sequential path) ───────────────────────────────────

  const {
    data: sponsorTxHash,
    writeContract: writeSponsor,
    error: sponsorError,
    reset: resetSponsor,
  } = useWriteContract();

  const {
    isSuccess: sponsorConfirmed,
    error: sponsorConfirmError,
  } = useWaitForTransactionReceipt({ hash: sponsorTxHash });

  // ─── 4. Batch path (EIP-5792) ──────────────────────────────────────────

  const {
    data: batchId,
    writeContracts,
    error: batchError,
    reset: resetBatch,
  } = useWriteContracts();

  const { data: callsStatus } = useCallsStatus({
    id: batchId?.id ?? "",
    query: { enabled: !!batchId?.id, refetchInterval: 2000 },
  });

  // ─── execute() ─────────────────────────────────────────────────────────

  const execute = useCallback(
    (authorAddr: `0x${string}`, amountUsdc: string) => {
      if (!address) return;
      const units = usdcToUnits(amountUsdc);

      setAuthor(authorAddr);
      setAmountUnits(units);
      setStep("checking_allowance");
      setErrorMessage("");
      setTxHash(undefined);
      setApproveSkipped(false);
      flowActiveRef.current = true;

      // Reset previous tx state
      resetApprove();
      resetSponsor();
      resetBatch();

      // Kick off allowance check
      refetchAllowance().then(({ data: currentAllowance }) => {
        if (!flowActiveRef.current) return;

        const sufficient =
          currentAllowance !== undefined && currentAllowance >= units;

        if (sufficient) {
          // Skip approve, go straight to sponsor
          setApproveSkipped(true);
          fireSponsor(authorAddr, units);
        } else if (useBatch) {
          // Try batch: approve + sponsor in one wallet prompt
          fireBatch(authorAddr, units);
        } else {
          // Sequential: approve first
          fireApprove(units);
        }
      });
    },
    [address, useBatch]
  );

  // ─── Internal fire functions ────────────────────────────────────────────

  function fireApprove(units: bigint) {
    setStep("approving");
    writeApprove({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [SPLITTER_ADDRESS, units],
      chain: base,
    });
  }

  function fireSponsor(authorAddr: `0x${string}`, units: bigint) {
    setStep("sending");
    writeSponsor({
      address: SPLITTER_ADDRESS,
      abi: SPLITTER_ABI,
      functionName: "sponsor",
      args: [authorAddr, units],
      chain: base,
    });
  }

  function fireBatch(authorAddr: `0x${string}`, units: bigint) {
    setStep("sending");
    writeContracts({
      contracts: [
        {
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SPLITTER_ADDRESS, units],
        },
        {
          address: SPLITTER_ADDRESS,
          abi: SPLITTER_ABI,
          functionName: "sponsor",
          args: [authorAddr, units],
        },
      ],
    });
  }

  // ─── Effect: approve tx hash received -> approve_confirming ─────────────

  useEffect(() => {
    if (approveTxHash && step === "approving") {
      setStep("approve_confirming");
    }
  }, [approveTxHash, step]);

  // ─── Effect: approve confirmed -> fire sponsor ──────────────────────────

  useEffect(() => {
    if (approveConfirmed && step === "approve_confirming" && author && amountUnits > BigInt(0)) {
      fireSponsor(author, amountUnits);
    }
  }, [approveConfirmed, step, author, amountUnits]);

  // ─── Effect: sponsor tx hash received -> confirming ─────────────────────

  useEffect(() => {
    if (sponsorTxHash && step === "sending") {
      setTxHash(sponsorTxHash);
      setStep("confirming");
    }
  }, [sponsorTxHash, step]);

  // ─── Effect: sponsor confirmed -> verifying (call onConfirmed) ──────────

  useEffect(() => {
    if (sponsorConfirmed && sponsorTxHash && step === "confirming") {
      setStep("verifying");
      if (onConfirmedRef.current) {
        onConfirmedRef.current(sponsorTxHash, {
          markSuccess: () => setStep("success"),
          markError: (msg: string) => {
            setErrorMessage(msg);
            setStep("error");
          },
        });
      } else {
        // No callback provided, just mark success
        setStep("success");
      }
    }
  }, [sponsorConfirmed, sponsorTxHash, step]);

  // ─── Effect: batch id received -> confirming ────────────────────────────

  useEffect(() => {
    if (batchId?.id && step === "sending") {
      setStep("confirming");
    }
  }, [batchId, step]);

  // ─── Effect: batch confirmed -> verifying ───────────────────────────────

  useEffect(() => {
    if (!callsStatus || step !== "confirming") return;
    if (callsStatus.status === "success") {
      const receipts = callsStatus.receipts;
      const hash = receipts?.[receipts.length - 1]?.transactionHash || batchId?.id || "";
      setTxHash(hash);
      setStep("verifying");

      if (onConfirmedRef.current) {
        onConfirmedRef.current(hash, {
          markSuccess: () => setStep("success"),
          markError: (msg: string) => {
            setErrorMessage(msg);
            setStep("error");
          },
        });
      } else {
        setStep("success");
      }
    }
  }, [callsStatus, step, batchId?.id]);

  // ─── Effect: batch error -> fallback to sequential ──────────────────────

  useEffect(() => {
    if (!batchError) return;
    const msg = batchError.message || "";
    const isUnsupported =
      msg.includes("not supported") ||
      msg.includes("Method not found") ||
      msg.includes("wallet_sendCalls") ||
      msg.includes("does not support");

    if (isUnsupported && author && amountUnits > BigInt(0)) {
      setUseBatch(false);
      resetBatch();
      // Fall back to sequential: need approve first
      fireApprove(amountUnits);
      return;
    }

    // User rejection or other error
    handleError(msg);
  }, [batchError]);

  // ─── Effect: approve errors ─────────────────────────────────────────────

  useEffect(() => {
    if (approveError) handleError(approveError.message);
  }, [approveError]);

  useEffect(() => {
    if (approveConfirmError) {
      handleError("Approve transaction failed on-chain. Please try again.");
    }
  }, [approveConfirmError]);

  // ─── Effect: sponsor errors ─────────────────────────────────────────────

  useEffect(() => {
    if (sponsorError) handleError(sponsorError.message);
  }, [sponsorError]);

  useEffect(() => {
    if (sponsorConfirmError) {
      handleError("Transaction failed on-chain. Please try again.");
    }
  }, [sponsorConfirmError]);

  // ─── Error helper ───────────────────────────────────────────────────────

  function handleError(msg: string) {
    const display = msg.includes("User rejected")
      ? "Transaction rejected. Try again when ready."
      : msg.length > 120
        ? msg.slice(0, 120) + "..."
        : msg;
    setErrorMessage(display);
    setStep("error");
    flowActiveRef.current = false;
  }

  // ─── reset() ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep("idle");
    setErrorMessage("");
    setTxHash(undefined);
    setApproveSkipped(false);
    setAuthor(null);
    setAmountUnits(BigInt(0));
    flowActiveRef.current = false;
    resetApprove();
    resetSponsor();
    resetBatch();
  }, []);

  return {
    step,
    errorMessage,
    txHash,
    approveSkipped,
    execute,
    reset,
  };
}
