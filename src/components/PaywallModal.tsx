"use client";

import { useState } from "react";

type PaywallStep =
  | "initial"
  | "payment_info"
  | "awaiting_confirmation"
  | "unlocked"
  | "error";

interface PaymentInfo {
  amount: string;
  currency: string;
  chain: string;
  chainId: number;
  contractAddress: string;
  recipient: string;
  memo: string;
  description: string;
}

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
  const [step, setStep] = useState<PaywallStep>("initial");
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [txRef, setTxRef] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlockClick() {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch(`/api/posts/${postId}?view=full`);

      if (res.status === 402) {
        const data = await res.json();
        if (data.payment) {
          setPaymentInfo(data.payment);
          setStep("payment_info");
        } else {
          setErrorMessage("Unexpected payment response format.");
          setStep("error");
        }
      } else if (res.ok) {
        const data = await res.json();
        onUnlocked(data.bodyHtml || data.body || "");
        setStep("unlocked");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Failed to fetch post.");
        setStep("error");
      }
    } catch (err) {
      setErrorMessage("Network error. Please try again.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPayment() {
    if (!txRef.trim()) {
      setErrorMessage("Please enter a transaction hash.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setStep("awaiting_confirmation");

    try {
      const res = await fetch(`/api/posts/${postId}?view=full`, {
        headers: {
          "X-Payment-Response": txRef.trim(),
          "X-Payer-Address": walletAddress.trim(),
        },
      });

      if (res.ok) {
        const data = await res.json();
        onUnlocked(data.bodyHtml || data.body || "");
        setStep("unlocked");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(
          data.error || "Payment verification failed. Please check your transaction."
        );
        setStep("error");
      }
    } catch (err) {
      setErrorMessage("Network error during verification. Please try again.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    setStep("initial");
    setErrorMessage("");
    setTxRef("");
    setWalletAddress("");
  }

  if (step === "unlocked") {
    return null;
  }

  return (
    <div className="relative mt-8">
      {/* Paywall card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center max-w-lg mx-auto">
        {step === "initial" && (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Continue reading
            </h3>
            <p className="text-gray-600 mb-1">This post is paywalled.</p>
            <div className="text-3xl font-bold text-gray-900 my-4">
              ${priceUsdc} <span className="text-lg font-normal text-gray-500">USDC</span>
            </div>
            <button
              onClick={handleUnlockClick}
              disabled={loading}
              className="btn-unlock w-full mb-3"
            >
              {loading ? "Loading..." : "Unlock this post"}
            </button>
            <p className="text-xs text-gray-400">
              Pay with USDC on Base
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 badge bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Base Network
            </div>
          </>
        )}

        {step === "payment_info" && paymentInfo && (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Payment Details
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-left mb-6 space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Amount
                </span>
                <p className="text-lg font-semibold text-gray-900">
                  {paymentInfo.amount} {paymentInfo.currency}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Recipient
                </span>
                <p className="text-sm font-mono text-gray-700 break-all">
                  {paymentInfo.recipient}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Network
                </span>
                <p className="text-sm text-gray-700">
                  Base (Chain ID: {paymentInfo.chainId})
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  USDC Contract
                </span>
                <p className="text-sm font-mono text-gray-700 break-all">
                  {paymentInfo.contractAddress}
                </p>
              </div>
              {paymentInfo.memo && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Memo
                  </span>
                  <p className="text-sm text-gray-700">{paymentInfo.memo}</p>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Send exactly <strong>{paymentInfo.amount} USDC</strong> to the
              recipient address above on Base, then enter your transaction hash
              below.
            </p>

            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Transaction hash (0x...)"
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
                className="input font-mono text-sm"
              />
              <input
                type="text"
                placeholder="Your wallet address (0x...)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="input font-mono text-sm"
              />
            </div>

            <button
              onClick={handleConfirmPayment}
              disabled={loading || !txRef.trim()}
              className="btn-unlock w-full"
            >
              {loading ? "Verifying..." : "I've sent the payment"}
            </button>
          </>
        )}

        {step === "awaiting_confirmation" && (
          <>
            <div className="animate-pulse mb-4">
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Verifying payment...
            </h3>
            <p className="text-sm text-gray-500">
              Checking your transaction on Base.
            </p>
          </>
        )}

        {step === "error" && (
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
            <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
            <button onClick={handleRetry} className="btn-secondary w-full">
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
