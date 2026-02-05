"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useModal } from "connectkit";
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
          // amount from server is in raw units; execute() expects decimal — use priceUsdc
          payment.execute(recipient as `0x${string}`, priceUsdc);
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
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center max-w-lg mx-auto">
        {displayStep === "initial" && (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Continue reading
            </h3>
            <p className="text-gray-600 mb-1">This post is paywalled.</p>
            <div className="text-3xl font-bold text-gray-900 my-4">
              ${priceUsdc}{" "}
              <span className="text-lg font-normal text-gray-500">USDC</span>
            </div>
            <button
              onClick={handleUnlockClick}
              className="btn-unlock w-full mb-3"
            >
              Unlock this post
            </button>
            <p className="text-xs text-gray-400">Pay with USDC on Base</p>
            <div className="mt-3 inline-flex items-center gap-1.5 badge bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Base Network
            </div>
          </>
        )}

        {displayStep === "not_connected" && (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Connect your wallet
            </h3>
            <p className="text-gray-600 mb-4">
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
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </>
        )}

        {displayStep === "wrong_chain" && (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Switch to Base
            </h3>
            <p className="text-gray-600 mb-4">
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
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </>
        )}

        {(displayStep === "fetching" || displayStep === "checking_allowance") && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Preparing payment...
            </h3>
            <p className="text-sm text-gray-500">
              Checking your USDC allowance.
            </p>
          </>
        )}

        {displayStep === "approving" && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Step 1/2: Approve USDC
            </h3>
            <p className="text-sm text-gray-500">
              Approve the splitter contract to spend{" "}
              <strong>${priceUsdc} USDC</strong> in your wallet.
            </p>
          </>
        )}

        {displayStep === "approve_confirming" && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Step 1/2: Confirming approval...
            </h3>
            <p className="text-sm text-gray-500">
              Waiting for approval transaction to confirm on Base.
            </p>
          </>
        )}

        {displayStep === "sending" && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {payment.approveSkipped ? "Confirm purchase" : "Step 2/2: Confirm purchase"}
            </h3>
            <p className="text-sm text-gray-500">
              Confirm the payment of{" "}
              <strong>${priceUsdc} USDC</strong> in your wallet.
            </p>
          </>
        )}

        {displayStep === "confirming" && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Confirming on Base...
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              Waiting for your transaction to be confirmed.
            </p>
            {payment.txHash && (
              <a
                href={`https://basescan.org/tx/${payment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline font-mono"
              >
                {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
              </a>
            )}
          </>
        )}

        {displayStep === "verifying" && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Submitting payment proof...
            </h3>
            <p className="text-sm text-gray-500">
              Sending transaction to Postera for verification.
            </p>
          </>
        )}

        {displayStep === "pending_confirmation" && (
          <>
            <Spinner />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Verifying on-chain...
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              Confirming your payment on Base. This usually takes a few seconds.
            </p>
            {payment.txHash && (
              <a
                href={`https://basescan.org/tx/${payment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline font-mono"
              >
                {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
              </a>
            )}
          </>
        )}

        {displayStep === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-600"
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
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
      <div className="w-12 h-12 rounded-full bg-indigo-100 mx-auto flex items-center justify-center">
        <svg
          className="w-6 h-6 text-indigo-600 animate-spin"
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
