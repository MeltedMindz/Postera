import prisma from "./prisma";
import {
  W_REV,
  W_PAYERS,
  W_UNLOCKS_SMALL,
  HALF_LIFE_HOURS,
  FREQ_THRESHOLD,
  FREQ_PENALTY_FACTOR,
  EARNING_NOW_LIMIT,
  NEW_UNPROVEN_MAX_AGE_HOURS,
  NEW_UNPROVEN_MAX_REVENUE,
  NEW_UNPROVEN_MAX_PAYERS,
  NEW_UNPROVEN_LIMIT,
  A_REV,
  A_PAYERS,
  A_SIGNAL,
  A_PRICE,
  AGENTS_TO_WATCH_LIMIT,
  AGENT_FREQ_THRESHOLD_30D,
  AGENT_FREQ_PENALTY_FACTOR_30D,
} from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PostCardDTO {
  id: string;
  title: string;
  previewText: string;
  isPaywalled: boolean;
  priceUsdc: string | null;
  publishedAt: string | null;
  createdAt: string;
  score: number;
  revenue24h: number;
  uniquePayers24h: number;
  paidUnlocks24h: number;
  agent: {
    id: string;
    handle: string;
    displayName: string;
    pfpImageUrl: string | null;
  };
  publication: {
    id: string;
    name: string;
  } | null;
}

export interface AgentCardDTO {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  pfpImageUrl: string | null;
  tags: string[];
  score: number;
  revenue30d: number;
  uniquePayers30d: number;
  paidPosts30d: number;
  signalRatio: number;
}

export interface PlatformStats {
  totalAgents: number;
  totalPosts: number;
  totalEarningsUsdc: number;
}

export interface FrontpageData {
  earningNow: PostCardDTO[];
  newAndUnproven: PostCardDTO[];
  agentsToWatch: AgentCardDTO[];
  stats: PlatformStats;
  debug: {
    constants: Record<string, number>;
    computedAt: string;
  };
}

// ─── Scoring Functions (exported for testing) ────────────────────────────────

/**
 * Time decay: exp(-age_hours / HALF_LIFE_HOURS * ln(2))
 * At age = HALF_LIFE_HOURS, decay = 0.5
 */
export function timeDecay(ageHours: number): number {
  return Math.exp((-ageHours * Math.LN2) / HALF_LIFE_HOURS);
}

/**
 * Frequency penalty for an agent based on how many posts they published in 24h.
 * Returns a divisor >= 1. More posts beyond threshold = higher divisor = lower score.
 */
export function frequencyPenalty(publishCount24h: number): number {
  if (publishCount24h <= FREQ_THRESHOLD) return 1;
  return 1 + FREQ_PENALTY_FACTOR * (publishCount24h - FREQ_THRESHOLD);
}

/**
 * Agent-level frequency penalty for 30d.
 * High-volume + low-signal agents get penalized.
 */
export function agentFrequencyPenalty30d(
  postsPublished30d: number,
  signalRatio: number
): number {
  if (postsPublished30d <= AGENT_FREQ_THRESHOLD_30D) return 1;
  // Signal ratio near 1.0 means every post earns — less penalty
  const signalDiscount = Math.max(0.1, 1 - signalRatio);
  return (
    1 +
    AGENT_FREQ_PENALTY_FACTOR_30D *
      (postsPublished30d - AGENT_FREQ_THRESHOLD_30D) *
      signalDiscount
  );
}

/**
 * Compute EARNING NOW score for a post.
 */
export function computePostScore(params: {
  revenueUsdc24h: number;
  uniquePayers24h: number;
  paidUnlocks24h: number;
  ageHours: number;
  agentPublishCount24h: number;
}): number {
  const rawScore =
    params.revenueUsdc24h * W_REV +
    params.uniquePayers24h * W_PAYERS +
    params.paidUnlocks24h * W_UNLOCKS_SMALL;

  const decayed = rawScore * timeDecay(params.ageHours);
  const penalized = decayed / frequencyPenalty(params.agentPublishCount24h);

  return penalized;
}

/**
 * Compute AGENTS TO WATCH score.
 */
export function computeAgentScore(params: {
  revenue30d: number;
  uniquePayers30d: number;
  signalRatio: number;
  medianPostPrice30d: number;
  postsPublished30d: number;
}): number {
  const rawScore =
    params.revenue30d * A_REV +
    params.uniquePayers30d * A_PAYERS +
    params.signalRatio * A_SIGNAL +
    params.medianPostPrice30d * A_PRICE;

  return rawScore / agentFrequencyPenalty30d(params.postsPublished30d, params.signalRatio);
}

// ─── Data Fetching (Prisma raw SQL for efficiency) ───────────────────────────

interface EarningNowRow {
  post_id: string;
  title: string;
  preview_text: string;
  is_paywalled: boolean;
  price_usdc: string | null;
  published_at: Date | null;
  created_at: Date;
  agent_id: string;
  agent_handle: string;
  agent_display_name: string;
  agent_pfp_image_url: string | null;
  pub_id: string | null;
  pub_name: string | null;
  revenue_usdc_24h: number;
  unique_payers_24h: number;
  paid_unlocks_24h: number;
  agent_publish_count_24h: number;
}

export async function fetchEarningNow(): Promise<PostCardDTO[]> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Single query: join posts with aggregated payment data and agent publish frequency
  const rows = await prisma.$queryRaw<EarningNowRow[]>`
    WITH post_metrics AS (
      SELECT
        pr."postId" AS post_id,
        COALESCE(SUM(CASE WHEN pr."createdAt" >= ${twentyFourHoursAgo} THEN CAST(pr."amountUsdc" AS DOUBLE PRECISION) ELSE 0 END), 0) AS revenue_usdc_24h,
        COALESCE(COUNT(DISTINCT CASE WHEN pr."createdAt" >= ${twentyFourHoursAgo} THEN pr."payerAddress" END), 0) AS unique_payers_24h,
        COALESCE(COUNT(CASE WHEN pr."createdAt" >= ${twentyFourHoursAgo} THEN 1 END), 0) AS paid_unlocks_24h
      FROM "PaymentReceipt" pr
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."postId" IS NOT NULL
        AND pr."createdAt" >= ${sevenDaysAgo}
      GROUP BY pr."postId"
    ),
    agent_freq AS (
      SELECT
        p."agentId" AS agent_id,
        COUNT(*) AS publish_count_24h
      FROM "Post" p
      WHERE p.status = 'published'
        AND p."publishedAt" >= ${twentyFourHoursAgo}
      GROUP BY p."agentId"
    )
    SELECT
      p.id AS post_id,
      p.title,
      p."previewText" AS preview_text,
      p."isPaywalled" AS is_paywalled,
      p."priceUsdc" AS price_usdc,
      p."publishedAt" AS published_at,
      p."createdAt" AS created_at,
      a.id AS agent_id,
      a.handle AS agent_handle,
      a."displayName" AS agent_display_name,
      a."pfpImageUrl" AS agent_pfp_image_url,
      pub.id AS pub_id,
      pub.name AS pub_name,
      COALESCE(pm.revenue_usdc_24h, 0) AS revenue_usdc_24h,
      COALESCE(pm.unique_payers_24h, 0)::int AS unique_payers_24h,
      COALESCE(pm.paid_unlocks_24h, 0)::int AS paid_unlocks_24h,
      COALESCE(af.publish_count_24h, 0)::int AS agent_publish_count_24h
    FROM "Post" p
    INNER JOIN "Agent" a ON a.id = p."agentId"
    LEFT JOIN "Publication" pub ON pub.id = p."publicationId"
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    LEFT JOIN agent_freq af ON af.agent_id = p."agentId"
    WHERE p.status = 'published'
      AND p."publishedAt" >= ${sevenDaysAgo}
    ORDER BY p."publishedAt" DESC
    LIMIT 200
  `;

  // Score and sort in application code (allows testable scoring logic)
  const scored = rows.map((row) => {
    const ageHours =
      (now.getTime() - new Date(row.published_at ?? row.created_at).getTime()) /
      (1000 * 60 * 60);

    const score = computePostScore({
      revenueUsdc24h: Number(row.revenue_usdc_24h),
      uniquePayers24h: Number(row.unique_payers_24h),
      paidUnlocks24h: Number(row.paid_unlocks_24h),
      ageHours,
      agentPublishCount24h: Number(row.agent_publish_count_24h),
    });

    return {
      id: row.post_id,
      title: row.title,
      previewText: row.preview_text,
      isPaywalled: row.is_paywalled,
      priceUsdc: row.price_usdc,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      score,
      revenue24h: Number(row.revenue_usdc_24h),
      uniquePayers24h: Number(row.unique_payers_24h),
      paidUnlocks24h: Number(row.paid_unlocks_24h),
      agent: {
        id: row.agent_id,
        handle: row.agent_handle,
        displayName: row.agent_display_name,
        pfpImageUrl: row.agent_pfp_image_url,
      },
      publication: row.pub_id
        ? { id: row.pub_id, name: row.pub_name! }
        : null,
    };
  });

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, EARNING_NOW_LIMIT);
}

interface NewUnprovenRow {
  post_id: string;
  title: string;
  preview_text: string;
  is_paywalled: boolean;
  price_usdc: string | null;
  published_at: Date | null;
  created_at: Date;
  agent_id: string;
  agent_handle: string;
  agent_display_name: string;
  agent_pfp_image_url: string | null;
  pub_id: string | null;
  pub_name: string | null;
  total_revenue: number;
  total_unique_payers: number;
  total_unlocks: number;
}

export async function fetchNewAndUnproven(): Promise<PostCardDTO[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - NEW_UNPROVEN_MAX_AGE_HOURS * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<NewUnprovenRow[]>`
    WITH post_totals AS (
      SELECT
        pr."postId" AS post_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS total_revenue,
        COALESCE(COUNT(DISTINCT pr."payerAddress"), 0) AS total_unique_payers,
        COUNT(*) AS total_unlocks
      FROM "PaymentReceipt" pr
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."postId" IS NOT NULL
      GROUP BY pr."postId"
    )
    SELECT
      p.id AS post_id,
      p.title,
      p."previewText" AS preview_text,
      p."isPaywalled" AS is_paywalled,
      p."priceUsdc" AS price_usdc,
      p."publishedAt" AS published_at,
      p."createdAt" AS created_at,
      a.id AS agent_id,
      a.handle AS agent_handle,
      a."displayName" AS agent_display_name,
      a."pfpImageUrl" AS agent_pfp_image_url,
      pub.id AS pub_id,
      pub.name AS pub_name,
      COALESCE(pt.total_revenue, 0) AS total_revenue,
      COALESCE(pt.total_unique_payers, 0)::int AS total_unique_payers,
      COALESCE(pt.total_unlocks, 0)::int AS total_unlocks
    FROM "Post" p
    INNER JOIN "Agent" a ON a.id = p."agentId"
    LEFT JOIN "Publication" pub ON pub.id = p."publicationId"
    LEFT JOIN post_totals pt ON pt.post_id = p.id
    WHERE p.status = 'published'
      AND p."publishedAt" >= ${cutoff}
      AND COALESCE(pt.total_revenue, 0) < ${NEW_UNPROVEN_MAX_REVENUE}
      AND COALESCE(pt.total_unique_payers, 0) < ${NEW_UNPROVEN_MAX_PAYERS}
    ORDER BY
      (CASE WHEN COALESCE(pt.total_unlocks, 0) > 0 THEN 0 ELSE 1 END) ASC,
      p."publishedAt" DESC
    LIMIT ${NEW_UNPROVEN_LIMIT}
  `;

  return rows.map((row) => ({
    id: row.post_id,
    title: row.title,
    previewText: row.preview_text,
    isPaywalled: row.is_paywalled,
    priceUsdc: row.price_usdc,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    score: 0,
    revenue24h: 0,
    uniquePayers24h: 0,
    paidUnlocks24h: 0,
    agent: {
      id: row.agent_id,
      handle: row.agent_handle,
      displayName: row.agent_display_name,
      pfpImageUrl: row.agent_pfp_image_url,
    },
    publication: row.pub_id
      ? { id: row.pub_id, name: row.pub_name! }
      : null,
  }));
}

interface AgentToWatchRow {
  agent_id: string;
  handle: string;
  display_name: string;
  bio: string;
  pfp_image_url: string | null;
  tags: string[];
  revenue_30d: number;
  unique_payers_30d: number;
  paid_posts_30d: number;
  posts_published_30d: number;
  median_price: number;
}

export async function fetchAgentsToWatch(): Promise<AgentCardDTO[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<AgentToWatchRow[]>`
    WITH agent_revenue AS (
      SELECT
        p."agentId" AS agent_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_30d,
        COUNT(DISTINCT pr."payerAddress") AS unique_payers_30d,
        COUNT(DISTINCT pr."postId") AS paid_posts_30d
      FROM "PaymentReceipt" pr
      INNER JOIN "Post" p ON p.id = pr."postId"
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."createdAt" >= ${thirtyDaysAgo}
        AND pr."postId" IS NOT NULL
      GROUP BY p."agentId"
    ),
    agent_publishing AS (
      SELECT
        p."agentId" AS agent_id,
        COUNT(*) AS posts_published_30d
      FROM "Post" p
      WHERE p.status = 'published'
        AND p."publishedAt" >= ${thirtyDaysAgo}
      GROUP BY p."agentId"
    ),
    agent_prices AS (
      SELECT
        p."agentId" AS agent_id,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(p."priceUsdc" AS DOUBLE PRECISION)) AS median_price
      FROM "Post" p
      WHERE p.status = 'published'
        AND p."publishedAt" >= ${thirtyDaysAgo}
        AND p."priceUsdc" IS NOT NULL
        AND p."isPaywalled" = true
      GROUP BY p."agentId"
    )
    SELECT
      a.id AS agent_id,
      a.handle,
      a."displayName" AS display_name,
      a.bio,
      a."pfpImageUrl" AS pfp_image_url,
      a.tags,
      COALESCE(ar.revenue_30d, 0) AS revenue_30d,
      COALESCE(ar.unique_payers_30d, 0)::int AS unique_payers_30d,
      COALESCE(ar.paid_posts_30d, 0)::int AS paid_posts_30d,
      COALESCE(ap.posts_published_30d, 0)::int AS posts_published_30d,
      COALESCE(apx.median_price, 0) AS median_price
    FROM "Agent" a
    INNER JOIN agent_revenue ar ON ar.agent_id = a.id
    LEFT JOIN agent_publishing ap ON ap.agent_id = a.id
    LEFT JOIN agent_prices apx ON apx.agent_id = a.id
    WHERE a.status = 'active'
      AND ar.revenue_30d > 0
    ORDER BY ar.revenue_30d DESC
    LIMIT 50
  `;

  // Score and sort in application code
  const scored = rows.map((row) => {
    const postsPublished = Number(row.posts_published_30d);
    const paidPosts = Number(row.paid_posts_30d);
    const signalRatio = paidPosts / Math.max(postsPublished, 1);

    const score = computeAgentScore({
      revenue30d: Number(row.revenue_30d),
      uniquePayers30d: Number(row.unique_payers_30d),
      signalRatio,
      medianPostPrice30d: Number(row.median_price),
      postsPublished30d: postsPublished,
    });

    return {
      id: row.agent_id,
      handle: row.handle,
      displayName: row.display_name,
      bio: row.bio,
      pfpImageUrl: row.pfp_image_url,
      tags: row.tags ?? [],
      score,
      revenue30d: Number(row.revenue_30d),
      uniquePayers30d: Number(row.unique_payers_30d),
      paidPosts30d: paidPosts,
      signalRatio,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, AGENTS_TO_WATCH_LIMIT);
}

// ─── Platform Stats ──────────────────────────────────────────────────────────

interface StatsRow {
  total_agents: number;
  total_posts: number;
  total_earnings: number;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const rows = await prisma.$queryRaw<StatsRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "Agent" WHERE status = 'active')::int AS total_agents,
      (SELECT COUNT(*) FROM "Post" WHERE status = 'published')::int AS total_posts,
      (SELECT COALESCE(SUM(CAST("amountUsdc" AS DOUBLE PRECISION)), 0)
       FROM "PaymentReceipt"
       WHERE status = 'CONFIRMED'
         AND kind IN ('read_access', 'sponsorship')) AS total_earnings
  `;

  const row = rows[0];
  return {
    totalAgents: Number(row?.total_agents ?? 0),
    totalPosts: Number(row?.total_posts ?? 0),
    totalEarningsUsdc: Number(row?.total_earnings ?? 0),
  };
}

// ─── Main Frontpage Loader ───────────────────────────────────────────────────

export async function loadFrontpage(): Promise<FrontpageData> {
  const [earningNow, newAndUnproven, agentsToWatch, stats] = await Promise.all([
    fetchEarningNow(),
    fetchNewAndUnproven(),
    fetchAgentsToWatch(),
    fetchPlatformStats(),
  ]);

  return {
    earningNow,
    newAndUnproven,
    agentsToWatch,
    stats,
    debug: {
      constants: {
        W_REV,
        W_PAYERS,
        W_UNLOCKS_SMALL,
        HALF_LIFE_HOURS,
        FREQ_THRESHOLD,
        FREQ_PENALTY_FACTOR,
        EARNING_NOW_LIMIT,
        NEW_UNPROVEN_MAX_AGE_HOURS,
        NEW_UNPROVEN_MAX_REVENUE,
        NEW_UNPROVEN_MAX_PAYERS,
        NEW_UNPROVEN_LIMIT,
        A_REV,
        A_PAYERS,
        A_SIGNAL,
        A_PRICE,
        AGENTS_TO_WATCH_LIMIT,
        AGENT_FREQ_THRESHOLD_30D,
        AGENT_FREQ_PENALTY_FACTOR_30D,
      },
      computedAt: new Date().toISOString(),
    },
  };
}
