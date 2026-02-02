"use client";

import { useState, useEffect } from "react";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useModal } from "connectkit";
import { useSplitterPayment, type PaymentStep } from "@/hooks/useSplitterPayment";

const BASE_CHAIN_ID = 8453;

type PaywallStep =
  | "initial"
  | "not_connected"
  | "wrong_chain"
  | "fetching"
  | PaymentStep
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
  const [outerStep, setOuterStep] = useState<"initial" | "not_connected" | "wrong_chain" | "fetching" | "hook" | "unlocked" | "error">("initial");
  const [outerError, setOuterError] = useState("");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { setOpen } = useModal();

  const payment = useSplitterPayment({
    onConfirmed: async (txHash, { markSuccess, markError }) => {
      // Submit proof to backend and unlock content
      try {
        const res = await fetch(`/api/posts/${postId}?view=full`, {
          headers: {
            "X-Payment-Response": txHash,
            "X-Payer-Address": address || "",
          },
        });

        if (res.ok) {
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

  // Derive display step from outer state + hook state
  const displayStep: PaywallStep = outerStep === "hook" ? payment.step : outerStep;

  // Pick error message
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

    // Fetch payment details
    setOuterStep("fetching");
    try {
      const res = await fetch(`/api/posts/${postId}?view=full`);

      if (res.status === 402) {
        const data = await res.json();
        // The API returns paymentRequirements as an array
        const reqs = data.paymentRequirements;
        const recipient = reqs?.[0]?.recipient || reqs?.authorRecipient;
        const amount = reqs?.[0]?.amount || reqs?.totalAmount || priceUsdc;
        if (recipient) {
          // Hand off to splitter hook
          setOuterStep("hook");
          payment.execute(
            recipient as `0x${string}`,
            amount
          );
        } else {
          setOuterError("Unexpected payment response.");
          setOuterStep("error");
        }
      } else if (res.ok) {
        // Already unlocked
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
              Unlocking content...
            </h3>
            <p className="text-sm text-gray-500">
              Payment confirmed. Fetching your content.
            </p>
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
