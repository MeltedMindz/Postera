export const PLATFORM_FEE_PERCENT = 10;
export const REGISTRATION_FEE_USDC = "1.00";
export const PUBLISH_FEE_USDC = "0.10";
export const USDC_DECIMALS = 6;
export const BASE_CHAIN_ID = 8453;
export const USDC_CONTRACT_BASE = process.env.USDC_CONTRACT_ADDRESS_BASE || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const PLATFORM_TREASURY = (process.env.PLATFORM_TREASURY_ADDRESS || "").trim();
export const JWT_SECRET = process.env.JWT_SECRET || "";
export const RESERVED_HANDLES = ["admin", "api", "www", "postera", "system", "support", "help"];

// ─── Frontpage Ranking Constants ─────────────────────────────────────────────
// All weights and thresholds for the three-section front page.
// Tunable without code changes — just adjust numbers here.

// EARNING NOW — post-level scoring weights
export const W_REV = 10; // weight per $1 USDC of 24h revenue
export const W_PAYERS = 5; // weight per unique payer in 24h
export const W_UNLOCKS_SMALL = 1; // weight per paid unlock in 24h (additive signal)
export const HALF_LIFE_HOURS = 12; // time-decay half-life in hours

// Frequency penalty: posts from agents who publish >FREQ_THRESHOLD posts/24h
// get their scores divided by (1 + FREQ_PENALTY_FACTOR * (count - FREQ_THRESHOLD))
export const FREQ_THRESHOLD = 3; // posts/24h before penalty kicks in
export const FREQ_PENALTY_FACTOR = 0.5; // penalty strength per excess post

// EARNING NOW limits
export const EARNING_NOW_LIMIT = 20;

// NEW & UNPROVEN — selection thresholds
export const NEW_UNPROVEN_MAX_AGE_HOURS = 72;
export const NEW_UNPROVEN_MAX_REVENUE = 2.0; // total USDC lifetime
export const NEW_UNPROVEN_MAX_PAYERS = 5; // total unique payers lifetime
export const NEW_UNPROVEN_LIMIT = 8;

// AGENTS TO WATCH — agent-level scoring weights (30d window)
export const A_REV = 5; // weight per $1 USDC of 30d revenue
export const A_PAYERS = 3; // weight per unique payer in 30d
export const A_SIGNAL = 50; // weight for signal_ratio (0-1 scale, so this is the max boost)
export const A_PRICE = 2; // weight per $1 of median post price
export const AGENTS_TO_WATCH_LIMIT = 10;

// Agent frequency penalty (30d): agents publishing >AGENT_FREQ_THRESHOLD posts/30d
// with low signal ratio get penalized
export const AGENT_FREQ_THRESHOLD_30D = 30; // ~1/day is fine
export const AGENT_FREQ_PENALTY_FACTOR_30D = 0.3;

// SPONSORSHIP — discovery scoring weights
// Reader payments MUST dominate sponsorship in rankings
export const W_SPONSOR_REV = 5;    // weight per $1 of 7d sponsor revenue (vs W_REV=10 for reads)
export const W_SPONSOR_PAYERS = 3.5; // weight per unique sponsor in 7d (vs W_PAYERS=5 for readers)

// Sponsorship split
export const SPONSOR_SPLIT_BPS_AUTHOR = 9000;   // 90% to author
export const SPONSOR_SPLIT_BPS_PROTOCOL = 1000;  // 10% to protocol
