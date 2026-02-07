"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useModal } from "connectkit";
import { getAddress } from "viem";
import { useSplitterPayment, type PaymentStep } from "@/hooks/useSplitterPayment";

const BASE_CHAIN_ID = 8453;
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60; // 3 minutes max polling

type PaywallStep =
  | "initial"
  | "not_connected"
  | "wrong_chain"
  | "fetching"
  | PaymentStep
  | "pending_confirmation"
  | "unlocked"
  | "error";

interface PaywallModalProps {
  postId: string;
  priceUsdc: string;
  onUnlocked: (bodyHtml: string) => void;
}

export default function PaywallModal({
  postId,
  priceUsdc,
  onUnlocked,
}: PaywallModalProps) {
  const [outerStep, setOuterStep] = useState<"initial" | "not_connected" | "wrong_chain" | "fetching" | "hook" | "pending_confirmation" | "unlocked" | "error">("initial");
  const [outerError, setOuterError] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { setOpen } = useModal();

  // Poll the payment status endpoint until CONFIRMED or terminal
  const pollPaymentStatus = useCallback(
    async (paymentId: string, pollCount = 0) => {
      if (pollCount >= MAX_POLLS) {
        setOuterError("Confirmation timed out. Your payment may still confirm — check back later.");
        setOuterStep("error");
        return;
      }

      try {
        const res = await fetch(`/api/payments/${paymentId}`);
        const data = await res.json();

        if (data.status === "CONFIRMED") {
          // Payment confirmed — now fetch the full content
          const contentRes = await fetch(`/api/posts/${postId}?view=full`, {
            headers: { "X-Payer-Address": address || "" },
          });
          if (contentRes.ok) {
            const contentData = await contentRes.json();
            onUnlocked(contentData.post?.bodyHtml || contentData.post?.body || "");
            setOuterStep("unlocked");
          } else {
            setOuterError("Payment confirmed but failed to fetch content.");
            setOuterStep("error");
          }
          return;
        }

        if (data.status === "FAILED" || data.status === "EXPIRED") {
          setOuterError(data.errorReason || `Payment ${data.status.toLowerCase()}.`);
          setOuterStep("error");
          return;
        }

        // Still PENDING — poll again with backoff
        const delay = Math.min(POLL_INTERVAL_MS * Math.pow(1.2, pollCount), 10000);
        pollRef.current = setTimeout(() => pollPaymentStatus(paymentId, pollCount + 1), delay);
      } catch {
        // Network error — retry
        pollRef.current = setTimeout(() => pollPaymentStatus(paymentId, pollCount + 1), POLL_INTERVAL_MS);
      }
    },
    [address, postId, onUnlocked]
  );

  const payment = useSplitterPayment({
    onConfirmed: async (txHash, { markSuccess, markError }) => {
      // Submit tx hash to backend — now returns 202 PENDING
      try {
        const res = await fetch(`/api/posts/${postId}?view=full`, {
          headers: {
            "X-Payment-Response": txHash,
            "X-Payer-Address": address || "",
          },
        });

        if (res.status === 202) {
          // Payment is PENDING — start polling
          const data = await res.json();
          markSuccess(); // Clear the hook state
          setOuterStep("pending_confirmation");
          pollPaymentStatus(data.paymentId);
        } else if (res.ok) {
          // Already confirmed (existing grant)
          const data = await res.json();
          onUnlocked(data.post?.bodyHtml || data.post?.body || "");
          markSuccess();
          setOuterStep("unlocked");
        } else {
          const data = await res.json().catch(() => ({}));
          markError(data.error || "Payment verification failed.");
        }
      } catch {
        markError("Network error during verification.");
      }
    },
  });

  // Derive display step
  const displayStep: PaywallStep = outerStep === "hook" ? payment.step : outerStep;
  const errorMsg = outerStep === "hook" ? payment.errorMessage : outerError;

  async function handleUnlockClick() {
    setOuterError("");

    if (!isConnected) {
      setOuterStep("not_connected");
      return;
    }

    if (chainId !== BASE_CHAIN_ID) {
      setOuterStep("wrong_chain");
      return;
    }

    setOuterStep("fetching");
    try {
      const res = await fetch(`/api/posts/${postId}?view=full`, {
        headers: { "X-Payer-Address": address || "" },
      });

      if (res.status === 402) {
        const data = await res.json();
        const reqs = data.accepts;
        const recipient = reqs?.[0]?.payTo;
        if (recipient) {
          setOuterStep("hook");
          // Normalize address to EIP-55 checksum; use decimal priceUsdc (not raw units)
          payment.execute(getAddress(recipient), priceUsdc);
        } else {
          setOuterError("Unexpected payment response.");
          setOuterStep("error");
        }
      } else if (res.ok) {
        const data = await res.json();
        onUnlocked(data.post?.bodyHtml || data.post?.body || "");
        setOuterStep("unlocked");
      } else {
        const data = await res.json().catch(() => ({}));
        setOuterError(data.error || "Failed to fetch post.");
        setOuterStep("error");
      }
    } catch {
      setOuterError("Network error. Please try again.");
      setOuterStep("error");
    }
  }

  function handleRetry() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setOuterStep("initial");
    setOuterError("");
    payment.reset();
  }

  if (displayStep === "unlocked" || displayStep === "success") return null;

  return (
    <div className="relative mt-8">
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center max-w-lg mx-auto">
        {displayStep === "initial" && (
          <>
            <p className="text-xs text-text-disabled uppercase tracking-widest font-mono mb-4">
              PREMIUM CONTENT
            </p>
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              Continue reading
            </h3>
            <p className="text-text-muted text-sm mb-1">This post is paywalled.</p>
            <div className="text-3xl font-bold text-text-primary my-6 font-mono font-tabular">
              ${priceUsdc}{" "}
              <span className="text-lg font-normal text-text-muted">USDC</span>
            </div>
            <button
              onClick={handleUnlockClick}
              className="btn-unlock w-full mb-3"
            >
              Unlock this post
            </button>
            <p className="text-xs text-text-disabled font-mono">Pay with USDC on Base</p>
            <div className="mt-3 inline-flex items-center gap-1.5 badge bg-bg-elevated text-text-muted border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-slate"></span>
              <span className="font-mono text-[11px]">Base Network</span>
            </div>
          </>
        )}

        {displayStep === "not_connected" && (
          <>
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              Connect your wallet
            </h3>
            <p className="text-text-muted text-sm mb-4">
              You need a wallet with USDC on Base to unlock this post.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="btn-unlock w-full mb-3"
            >
              Connect Wallet
            </button>
            <button
              onClick={() => setOuterStep("initial")}
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-150"
            >
              Back
            </button>
          </>
        )}

        {displayStep === "wrong_chain" && (
          <>
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              Switch to Base
            </h3>
            <p className="text-text-muted text-sm mb-4">
              Please switch your wallet to the Base network to continue.
            </p>
            <button
              onClick={() => switchChain({ chainId: BASE_CHAIN_ID })}
              className="btn-unlock w-full mb-3"
            >
              Switch to Base
            </button>
            <button
              onClick={() => setOuterStep("initial")}
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-150"
            >
              Back
            </button>
          </>
        )}

        {(displayStep === "fetching" || displayStep === "checking_allowance") && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Preparing payment...
            </h3>
            <p className="text-sm text-text-muted">
              Checking your USDC allowance.
            </p>
          </>
        )}

        {displayStep === "approving" && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Step 1/2: Approve USDC
            </h3>
            <p className="text-sm text-text-muted">
              Approve the splitter contract to spend{" "}
              <strong className="text-text-primary font-mono">${priceUsdc} USDC</strong> in your wallet.
            </p>
          </>
        )}

        {displayStep === "approve_confirming" && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Step 1/2: Confirming approval...
            </h3>
            <p className="text-sm text-text-muted">
              Waiting for approval transaction to confirm on Base.
            </p>
          </>
        )}

        {displayStep === "sending" && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {payment.approveSkipped ? "Confirm purchase" : "Step 2/2: Confirm purchase"}
            </h3>
            <p className="text-sm text-text-muted">
              Confirm the payment of{" "}
              <strong className="text-text-primary font-mono">${priceUsdc} USDC</strong> in your wallet.
            </p>
          </>
        )}

        {displayStep === "confirming" && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Confirming on Base...
            </h3>
            <p className="text-sm text-text-muted mb-2">
              Waiting for your transaction to be confirmed.
            </p>
            {payment.txHash && (
              <a
                href={`https://basescan.org/tx/${payment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-slate hover:text-text-primary transition-colors duration-150 font-mono"
              >
                {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
              </a>
            )}
          </>
        )}

        {displayStep === "verifying" && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Submitting payment proof...
            </h3>
            <p className="text-sm text-text-muted">
              Sending transaction to Postera for verification.
            </p>
          </>
        )}

        {displayStep === "pending_confirmation" && (
          <>
            <Spinner />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Verifying on-chain...
            </h3>
            <p className="text-sm text-text-muted mb-2">
              Confirming your payment on Base. This usually takes a few seconds.
            </p>
            {payment.txHash && (
              <a
                href={`https://basescan.org/tx/${payment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-slate hover:text-text-primary transition-colors duration-150 font-mono"
              >
                {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
              </a>
            )}
          </>
        )}

        {displayStep === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-bg-elevated mx-auto flex items-center justify-center mb-4 border border-border">
              <svg
                className="w-6 h-6 text-accent-red"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Something went wrong
            </h3>
            <p className="text-sm text-accent-red mb-4">{errorMsg}</p>
            <button onClick={handleRetry} className="btn-secondary w-full">
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="mb-4">
      <div className="w-12 h-12 rounded-full bg-bg-elevated mx-auto flex items-center justify-center border border-border">
        <svg
          className="w-6 h-6 text-text-muted animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>
  );
}
