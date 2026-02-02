"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useModal } from "connectkit";
import { useSplitterPayment, type PaymentStep } from "@/hooks/useSplitterPayment";

const BASE_CHAIN_ID = 8453;
const PRESET_AMOUNTS = ["0.25", "0.50", "1.00"];
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

type SponsorStep =
  | "select"
  | "not_connected"
  | "wrong_chain"
  | "fetching"
  | PaymentStep
  | "pending_confirmation"
  | "success"
  | "error";

interface SponsorButtonProps {
  postId: string;
  postTitle: string;
  totalEarned: number;
  sponsorEarned: number;
  uniqueSponsors: number;
}

export default function SponsorButton({
  postId,
  postTitle,
  totalEarned,
  sponsorEarned,
  uniqueSponsors,
}: SponsorButtonProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [outerStep, setOuterStep] = useState<"select" | "not_connected" | "wrong_chain" | "fetching" | "hook" | "pending_confirmation" | "success" | "error">("select");
  const [outerError, setOuterError] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { setOpen } = useModal();

  const amount = selected === "custom" ? custom : selected;

  const pollPaymentStatus = useCallback(
    async (paymentId: string, pollCount = 0) => {
      if (pollCount >= MAX_POLLS) {
        setOuterError("Confirmation timed out. Your sponsorship may still confirm — check back later.");
        setOuterStep("error");
        return;
      }

      try {
        const res = await fetch(`/api/payments/${paymentId}`);
        const data = await res.json();

        if (data.status === "CONFIRMED") {
          setOuterStep("success");
          return;
        }

        if (data.status === "FAILED" || data.status === "EXPIRED") {
          setOuterError(data.errorReason || `Payment ${data.status.toLowerCase()}.`);
          setOuterStep("error");
          return;
        }

        const delay = Math.min(POLL_INTERVAL_MS * Math.pow(1.2, pollCount), 10000);
        pollRef.current = setTimeout(() => pollPaymentStatus(paymentId, pollCount + 1), delay);
      } catch {
        pollRef.current = setTimeout(() => pollPaymentStatus(paymentId, pollCount + 1), POLL_INTERVAL_MS);
      }
    },
    []
  );

  const payment = useSplitterPayment({
    onConfirmed: async (txHash, { markSuccess, markError }) => {
      try {
        const res = await fetch(`/api/posts/${postId}/sponsor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Response": txHash,
            "X-Payer-Address": address || "",
          },
          body: JSON.stringify({ amountUsdc: amount }),
        });

        if (res.status === 202) {
          const data = await res.json();
          markSuccess();
          setOuterStep("pending_confirmation");
          pollPaymentStatus(data.paymentId);
        } else if (res.ok || res.status === 201) {
          markSuccess();
          setOuterStep("success");
        } else {
          const data = await res.json().catch(() => ({}));
          markError(data.error || "Payment verification failed.");
        }
      } catch {
        markError("Network error during verification.");
      }
    },
  });

  // Derive the display step from outer state + hook state
  const displayStep: SponsorStep = outerStep === "hook" ? payment.step : outerStep;

  async function handleSponsorClick() {
    if (!amount || parseFloat(amount) <= 0) return;
    setOuterError("");

    if (!isConnected) {
      setOuterStep("not_connected");
      return;
    }

    if (chainId !== BASE_CHAIN_ID) {
      setOuterStep("wrong_chain");
      return;
    }

    // Fetch payment details from backend
    setOuterStep("fetching");
    try {
      const res = await fetch(`/api/posts/${postId}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount }),
      });

      if (res.status === 402) {
        const data = await res.json();
        const reqs = data.paymentRequirements;
        if (!reqs?.authorRecipient) {
          setOuterError("Could not determine payment recipient.");
          setOuterStep("error");
          return;
        }

        // Hand off to the splitter hook
        setOuterStep("hook");
        payment.execute(
          reqs.authorRecipient as `0x${string}`,
          amount
        );
      } else if (res.ok) {
        setOuterStep("success");
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setOuterError(data.error || "Sponsorship failed");
        setOuterStep("error");
      }
    } catch {
      setOuterError("Network error. Please try again.");
      setOuterStep("error");
    }
  }

  function handleRetry() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setOuterStep("select");
    setOuterError("");
    payment.reset();
  }

  const fmtUsdc = (n: number) => (n > 0 ? `$${n.toFixed(2)}` : "$0.00");

  // Pick error message from either outer or hook
  const errorMsg = outerStep === "hook" ? payment.errorMessage : outerError;

  // ─── Render ─────────────────────────────────────────────────────────────

  if (displayStep === "success") {
    return (
      <div className="mt-8 p-6 border border-emerald-200 bg-emerald-50 rounded-lg text-center">
        <p className="text-emerald-700 font-medium">
          Thanks for sponsoring this post! ({amount} USDC)
        </p>
        <p className="text-xs text-emerald-600 mt-1">
          Refresh the page to see updated earnings.
        </p>
        {payment.txHash && (
          <a
            href={`https://basescan.org/tx/${payment.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:underline font-mono mt-2 inline-block"
          >
            {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
          </a>
        )}
      </div>
    );
  }

  const isSelectState =
    displayStep === "select" ||
    displayStep === "not_connected" ||
    displayStep === "wrong_chain" ||
    displayStep === "error" ||
    displayStep === "idle";

  return (
    <div className="mt-8 p-6 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Sponsor this post</h3>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{fmtUsdc(totalEarned)} earned</p>
          {sponsorEarned > 0 && (
            <p className="text-xs text-gray-500">
              {fmtUsdc(sponsorEarned)} from {uniqueSponsors} sponsor
              {uniqueSponsors !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Support this free content. 90% goes to the author, 10% to the protocol.
      </p>

      {/* Amount selection */}
      {isSelectState && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  setSelected(amt);
                  setCustom("");
                  if (outerStep !== "select") { setOuterStep("select"); payment.reset(); }
                }}
                className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                  selected === amt
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
                }`}
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => {
                setSelected("custom");
                if (outerStep !== "select") { setOuterStep("select"); payment.reset(); }
              }}
              className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                selected === "custom"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
              }`}
            >
              Custom
            </button>
          </div>

          {selected === "custom" && (
            <input
              type="text"
              inputMode="decimal"
              placeholder="Amount in USDC"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </>
      )}

      {displayStep === "not_connected" && (
        <div className="mb-4">
          <button
            onClick={() => setOpen(true)}
            className="w-full py-2 rounded bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            Connect Wallet
          </button>
          <p className="mt-2 text-xs text-gray-500 text-center">
            You need a wallet with USDC on Base to sponsor.
          </p>
        </div>
      )}

      {displayStep === "wrong_chain" && (
        <div className="mb-4">
          <button
            onClick={() => switchChain({ chainId: BASE_CHAIN_ID })}
            className="w-full py-2 rounded bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            Switch to Base
          </button>
          <p className="mt-2 text-xs text-gray-500 text-center">
            Please switch to the Base network to continue.
          </p>
        </div>
      )}

      {(displayStep === "select" || displayStep === "idle") && amount && parseFloat(amount) > 0 && (
        <button
          onClick={handleSponsorClick}
          className="w-full py-2 rounded bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
        >
          Sponsor {amount} USDC
        </button>
      )}

      {displayStep === "fetching" || displayStep === "checking_allowance" ? (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Preparing payment...</p>
        </div>
      ) : null}

      {displayStep === "approving" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">
            Step 1/2: Approve USDC spending in your wallet.
          </p>
        </div>
      )}

      {displayStep === "approve_confirming" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">
            Step 1/2: Confirming approval on Base...
          </p>
        </div>
      )}

      {displayStep === "sending" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">
            {payment.approveSkipped ? (
              <>Confirm the sponsorship of <strong>${amount} USDC</strong> in your wallet.</>
            ) : (
              <>Step 2/2: Confirm the sponsorship of <strong>${amount} USDC</strong> in your wallet.</>
            )}
          </p>
        </div>
      )}

      {displayStep === "confirming" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Confirming on Base...</p>
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
        </div>
      )}

      {displayStep === "verifying" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Submitting sponsorship proof...</p>
        </div>
      )}

      {displayStep === "pending_confirmation" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Verifying on-chain...</p>
          {payment.txHash && (
            <a
              href={`https://basescan.org/tx/${payment.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline font-mono mt-1 inline-block"
            >
              {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
            </a>
          )}
        </div>
      )}

      {displayStep === "error" && (
        <div className="mt-3">
          <p className="text-xs text-red-600 mb-2">{errorMsg}</p>
          <button onClick={handleRetry} className="text-xs text-indigo-600 hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="inline-block">
      <svg className="w-5 h-5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
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
  );
}
