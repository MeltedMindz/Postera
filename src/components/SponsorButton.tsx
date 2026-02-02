"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { base } from "wagmi/chains";
import { useModal } from "connectkit";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const BASE_CHAIN_ID = 8453;

const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function usdcToUnits(amount: string): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0]) * BigInt(10 ** 6);
  if (parts[1]) {
    const decimals = parts[1].padEnd(6, "0").slice(0, 6);
    return whole + BigInt(decimals);
  }
  return whole;
}

interface SponsorButtonProps {
  postId: string;
  postTitle: string;
  totalEarned: number;
  sponsorEarned: number;
  uniqueSponsors: number;
}

const PRESET_AMOUNTS = ["0.25", "0.50", "1.00"];

type SponsorStep =
  | "select"
  | "not_connected"
  | "wrong_chain"
  | "fetching"
  | "sending"
  | "confirming"
  | "verifying"
  | "success"
  | "error";

export default function SponsorButton({
  postId,
  postTitle,
  totalEarned,
  sponsorEarned,
  uniqueSponsors,
}: SponsorButtonProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [step, setStep] = useState<SponsorStep>("select");
  const [errorMsg, setErrorMsg] = useState("");
  const [recipient, setRecipient] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { setOpen } = useModal();

  const {
    data: txHash,
    writeContract,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const amount = selected === "custom" ? custom : selected;

  // When tx confirms, submit proof to backend
  useEffect(() => {
    if (isConfirmed && txHash && address && step === "confirming") {
      submitProof(txHash, address);
    }
  }, [isConfirmed, txHash, address, step]);

  // Track write errors
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message.includes("User rejected")
        ? "Transaction rejected. Try again when ready."
        : writeError.message.length > 100
        ? writeError.message.slice(0, 100) + "..."
        : writeError.message;
      setErrorMsg(msg);
      setStep("error");
    }
  }, [writeError]);

  // Track confirmation errors
  useEffect(() => {
    if (confirmError) {
      setErrorMsg("Transaction failed on-chain. Please try again.");
      setStep("error");
    }
  }, [confirmError]);

  // Move to confirming state when tx is sent
  useEffect(() => {
    if (txHash && step === "sending") {
      setStep("confirming");
    }
  }, [txHash, step]);

  async function handleSponsorClick() {
    if (!amount || parseFloat(amount) <= 0) return;
    setErrorMsg("");

    if (!isConnected) {
      setStep("not_connected");
      return;
    }

    if (chainId !== BASE_CHAIN_ID) {
      setStep("wrong_chain");
      return;
    }

    // Fetch payment details from sponsor endpoint (get 402 with recipient)
    setStep("fetching");
    try {
      const res = await fetch(`/api/posts/${postId}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount }),
      });

      if (res.status === 402) {
        const data = await res.json();
        const reqs = data.paymentRequirements;
        if (reqs?.recipient) {
          setRecipient(reqs.recipient);
          sendPayment(amount, reqs.recipient);
        } else {
          setErrorMsg("Could not determine payment recipient.");
          setStep("error");
        }
      } else if (res.ok) {
        setStep("success");
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setErrorMsg(data.error || "Sponsorship failed");
        setStep("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStep("error");
    }
  }

  function sendPayment(amt: string, to: string) {
    setStep("sending");
    resetWrite();
    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "transfer",
      args: [to as `0x${string}`, usdcToUnits(amt)],
      chain: base,
    });
  }

  async function submitProof(hash: string, payer: string) {
    setStep("verifying");
    try {
      const res = await fetch(`/api/posts/${postId}/sponsor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Response": hash,
          "X-Payer-Address": payer,
        },
        body: JSON.stringify({ amountUsdc: amount }),
      });

      if (res.ok || res.status === 201) {
        setStep("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Payment verification failed.");
        setStep("error");
      }
    } catch {
      setErrorMsg("Network error during verification.");
      setStep("error");
    }
  }

  function handleRetry() {
    setStep("select");
    setErrorMsg("");
    resetWrite();
  }

  const fmtUsdc = (n: number) => (n > 0 ? `$${n.toFixed(2)}` : "$0.00");

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="mt-8 p-6 border border-emerald-200 bg-emerald-50 rounded-lg text-center">
        <p className="text-emerald-700 font-medium">
          Thanks for sponsoring this post! ({amount} USDC)
        </p>
        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:underline font-mono mt-2 inline-block"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        )}
      </div>
    );
  }

  const isSelectState =
    step === "select" || step === "not_connected" || step === "wrong_chain" || step === "error";

  return (
    <div className="mt-8 p-6 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Sponsor this post</h3>
        {/* Earnings tally */}
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
        Support this free content with a direct payment to the author.
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
                  if (step !== "select") setStep("select");
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
                if (step !== "select") setStep("select");
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

      {/* Connect wallet prompt */}
      {step === "not_connected" && (
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

      {/* Switch chain prompt */}
      {step === "wrong_chain" && (
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

      {/* Main sponsor button */}
      {step === "select" && amount && parseFloat(amount) > 0 && (
        <button
          onClick={handleSponsorClick}
          className="w-full py-2 rounded bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
        >
          Sponsor {amount} USDC
        </button>
      )}

      {/* Loading / in-progress states */}
      {step === "fetching" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Preparing payment...</p>
        </div>
      )}

      {step === "sending" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">
            Confirm the transfer of <strong>${amount} USDC</strong> in your wallet.
          </p>
        </div>
      )}

      {step === "confirming" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Confirming on Base...</p>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline font-mono"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          )}
        </div>
      )}

      {step === "verifying" && (
        <div className="text-center py-3">
          <Spinner />
          <p className="text-sm text-gray-500 mt-2">Recording sponsorship...</p>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
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
