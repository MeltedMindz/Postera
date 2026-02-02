# Where We Were — Feb 2, 2026

## What's Done (Deployed + Pushed)

### OG Images — FIXED
- Route was 500ing because Satori can't handle `\n` newlines, `---` dashes, or `backgroundImage: linear-gradient()` in JSX text
- Removed avatar fetch (was causing timeouts on Vercel serverless)
- Separated DB and render into independent try/catch blocks so failures return a fallback image
- Added `force-dynamic` to prevent stale cached responses
- **Verified working**: `curl` returns `200 image/png` for the Axiom post

### Tally — FIXED (partially)
- Removed the client-side optimistic tally update that showed new earnings before page refresh
- Success state now says "Refresh the page to see updated earnings" instead of incrementing the number
- Server-rendered tally only updates on page load (from the Prisma query)

### Sponsor Button — Working (single transfer)
- Uses wagmi `useWriteContract` for single USDC transfer
- Uses `useWriteContracts` from `wagmi/experimental` (EIP-5792) to attempt batch two transfers (90% author, 10% protocol) in one wallet approval
- Falls back to single transfer if wallet doesn't support EIP-5792

---

## What's Still Broken

### 90/10 Split Not Happening On-Chain
**This is the main open issue.** The EIP-5792 batch approach (`useWriteContracts`) only works with wallets that support `wallet_sendCalls` — primarily **Coinbase Smart Wallet**. MetaMask and most other wallets don't support it yet.

When the batch fails (wallet doesn't support EIP-5792), the code falls back to a **single transfer of the full amount to the author**. The protocol gets nothing on-chain.

**The tx that failed**: `0xef81904ae21c11ffba17446b2bb9b355b9d9aa33d5db40fd4fd78cff8b0d4663` — sent full $1.00 to the author, no split.

### Options to Actually Fix the Split

1. **Require Coinbase Smart Wallet** — only wallets supporting EIP-5792 can sponsor. Limits user base but split works.

2. **Deploy a PaymentSplitter contract on Base** — a tiny Solidity contract:
   ```solidity
   function sponsor(address author, uint256 total) external {
       uint256 authorAmt = (total * 9000) / 10000;
       usdc.transferFrom(msg.sender, author, authorAmt);
       usdc.transferFrom(msg.sender, protocol, total - authorAmt);
   }
   ```
   User does `approve(splitter, amount)` once, then each sponsorship is one tx. Requires Foundry/Hardhat setup + contract deployment.

3. **Send full amount to author, protocol fee is accounting** — the current fallback behavior. Works but doesn't satisfy the requirement for on-chain split.

4. **Send full amount to treasury, treasury distributes** — user rejected this previously ("no this cant be how it works").

### Recommendation
Option 2 (splitter contract) is the most robust. One-time deploy, then every sponsorship is one tx with real on-chain split. Requires:
- Install Foundry or write deploy script
- Write ~20 lines of Solidity
- Deploy to Base mainnet
- Update SponsorButton to call the splitter instead of direct USDC transfer

---

## Key Files

| File | Status |
|------|--------|
| `src/components/SponsorButton.tsx` | Has EIP-5792 batch + single fallback. Needs update if deploying splitter. |
| `src/app/api/posts/[postId]/sponsor/route.ts` | Returns split amounts in 402 response. Works. |
| `src/app/post/[postId]/page.tsx` | Passes `totalEarned`, `sponsorEarned`, `uniqueSponsors` to SponsorButton. Works. |
| `src/app/post/[postId]/og/route.tsx` | Fixed. Returns 200 image/png. |
| `src/lib/constants.ts` | Has `.trim()` on PLATFORM_TREASURY. |

## Recent Commits (newest first)
- `f172754` — Fix OG image crash + remove premature tally update
- `7ef3a6f` — Trim PLATFORM_TREASURY env var to fix trailing space in address
- `537435b` — Sponsor: EIP-5792 batch split (90/10 on-chain) with fallback + tally fix
- `5cb9ff7` — Sponsor flow: single transfer to author, earnings tally in UI

## What to Do Next
1. Decide on split approach (splitter contract vs. accept single-transfer fallback)
2. If splitter contract: set up Foundry, write contract, deploy, update SponsorButton
3. Test the full sponsor flow end-to-end with the chosen approach
4. Verify OG images are populating on social sharing tools
