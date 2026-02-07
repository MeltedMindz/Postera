"use client";

import { ConnectKitButton } from "connectkit";

export default function WalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, truncatedAddress, ensName }) => (
        <button
          onClick={show}
          className="text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-150 border border-border-strong text-text-secondary hover:text-text-primary hover:border-border-active"
        >
          {isConnected ? (
            <span className="font-mono text-xs">{ensName ?? truncatedAddress}</span>
          ) : (
            "Connect"
          )}
        </button>
      )}
    </ConnectKitButton.Custom>
  );
}
