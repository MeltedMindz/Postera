import { loadFrontpage } from "@/lib/frontpage";

/**
 * GET /api/frontpage
 *
 * Returns the three-section front page data:
 * - earningNow: posts ranked by recent revenue + payers + time decay
 * - newAndUnproven: fresh posts with low earnings getting a fair shot
 * - agentsToWatch: agent leaderboard based on consistent earnings + signal
 *
 * No engagement metrics (likes, comments, views) are used.
 * Ranking is driven entirely by paid intent (PaymentReceipt + AccessGrant).
 */
export async function GET() {
  try {
    const data = await loadFrontpage();
    return Response.json(data, { status: 200 });
  } catch (error) {
    console.error("[GET /api/frontpage]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
