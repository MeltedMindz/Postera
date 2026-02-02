import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import {
  W_REV,
  W_PAYERS,
  HALF_LIFE_HOURS,
  A_REV,
  A_PAYERS,
  W_SPONSOR_REV,
  W_SPONSOR_PAYERS,
} from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentResultDTO {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  pfpImageUrl: string | null;
  tags: string[];
  score: number;
  revenue30d: number;
  uniquePayers30d: number;
}

export interface PubResultDTO {
  id: string;
  name: string;
  description: string;
  tags: string[];
  agentHandle: string;
  agentDisplayName: string;
  score: number;
  revenue30d: number;
  uniquePayers30d: number;
}

export interface PostResultDTO {
  id: string;
  title: string;
  previewText: string;
  isPaywalled: boolean;
  priceUsdc: string | null;
  publishedAt: string | null;
  tags: string[];
  score: number;
  revenue7d: number;
  uniquePayers7d: number;
  sponsorRevenue7d: number;
  uniqueSponsors7d: number;
  agent: {
    handle: string;
    displayName: string;
    pfpImageUrl: string | null;
  };
  publication: { id: string; name: string } | null;
}

export interface TagResultDTO {
  tag: string;
  postCount: number;
  paidUnlocks7d: number;
  revenue7d: number;
}

export interface SearchResults {
  q: string;
  results: {
    agents: AgentResultDTO[];
    pubs: PubResultDTO[];
    posts: PostResultDTO[];
    tags: TagResultDTO[];
  };
  nextCursor?: string;
}

// ─── Time Decay (reuse same formula as frontpage) ────────────────────────────

function timeDecay(ageHours: number): number {
  return Math.exp((-ageHours * Math.LN2) / HALF_LIFE_HOURS);
}

// ─── Search: Agents ──────────────────────────────────────────────────────────

interface AgentSearchRow {
  agent_id: string;
  handle: string;
  display_name: string;
  bio: string;
  pfp_image_url: string | null;
  tags: string[];
  revenue_30d: number;
  unique_payers_30d: number;
}

export async function searchAgents(
  query: string,
  limit: number
): Promise<AgentResultDTO[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pattern = `%${query}%`;

  const rows = await prisma.$queryRaw<AgentSearchRow[]>`
    WITH agent_rev AS (
      SELECT
        p."agentId" AS agent_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_30d,
        COUNT(DISTINCT pr."payerAddress") AS unique_payers_30d
      FROM "PaymentReceipt" pr
      INNER JOIN "Post" p ON p.id = pr."postId"
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."createdAt" >= ${thirtyDaysAgo}
        AND pr."postId" IS NOT NULL
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
      COALESCE(ar.unique_payers_30d, 0)::int AS unique_payers_30d
    FROM "Agent" a
    LEFT JOIN agent_rev ar ON ar.agent_id = a.id
    WHERE a.status = 'active'
      AND (
        a.handle ILIKE ${pattern}
        OR a."displayName" ILIKE ${pattern}
        OR a.bio ILIKE ${pattern}
      )
    ORDER BY COALESCE(ar.revenue_30d, 0) DESC, a."createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => {
    const score =
      Number(row.revenue_30d) * A_REV +
      Number(row.unique_payers_30d) * A_PAYERS;
    return {
      id: row.agent_id,
      handle: row.handle,
      displayName: row.display_name,
      bio: row.bio.length > 150 ? row.bio.slice(0, 150) + "..." : row.bio,
      pfpImageUrl: row.pfp_image_url,
      tags: row.tags ?? [],
      score,
      revenue30d: Number(row.revenue_30d),
      uniquePayers30d: Number(row.unique_payers_30d),
    };
  });
}

// ─── Search: Publications ────────────────────────────────────────────────────

interface PubSearchRow {
  pub_id: string;
  name: string;
  description: string;
  tags: string[];
  agent_handle: string;
  agent_display_name: string;
  revenue_30d: number;
  unique_payers_30d: number;
}

export async function searchPubs(
  query: string,
  limit: number
): Promise<PubResultDTO[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pattern = `%${query}%`;

  const rows = await prisma.$queryRaw<PubSearchRow[]>`
    WITH pub_rev AS (
      SELECT
        pr."publicationId" AS pub_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_30d,
        COUNT(DISTINCT pr."payerAddress") AS unique_payers_30d
      FROM "PaymentReceipt" pr
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."publicationId" IS NOT NULL
        AND pr."createdAt" >= ${thirtyDaysAgo}
      GROUP BY pr."publicationId"
    )
    SELECT
      pub.id AS pub_id,
      pub.name,
      pub.description,
      pub.tags,
      a.handle AS agent_handle,
      a."displayName" AS agent_display_name,
      COALESCE(prvw.revenue_30d, 0) AS revenue_30d,
      COALESCE(prvw.unique_payers_30d, 0)::int AS unique_payers_30d
    FROM "Publication" pub
    INNER JOIN "Agent" a ON a.id = pub."agentId"
    LEFT JOIN pub_rev prvw ON prvw.pub_id = pub.id
    WHERE a.status = 'active'
      AND (
        pub.name ILIKE ${pattern}
        OR pub.description ILIKE ${pattern}
        OR a.handle ILIKE ${pattern}
      )
    ORDER BY COALESCE(prvw.revenue_30d, 0) DESC, pub."createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => {
    const score =
      Number(row.revenue_30d) * A_REV +
      Number(row.unique_payers_30d) * A_PAYERS;
    return {
      id: row.pub_id,
      name: row.name,
      description:
        row.description.length > 150
          ? row.description.slice(0, 150) + "..."
          : row.description,
      tags: row.tags ?? [],
      agentHandle: row.agent_handle,
      agentDisplayName: row.agent_display_name,
      score,
      revenue30d: Number(row.revenue_30d),
      uniquePayers30d: Number(row.unique_payers_30d),
    };
  });
}

// ─── Search: Posts ───────────────────────────────────────────────────────────

interface PostSearchRow {
  post_id: string;
  title: string;
  preview_text: string;
  is_paywalled: boolean;
  price_usdc: string | null;
  published_at: Date | null;
  tags: string[];
  agent_handle: string;
  agent_display_name: string;
  agent_pfp_image_url: string | null;
  pub_id: string | null;
  pub_name: string | null;
  revenue_7d: number;
  unique_payers_7d: number;
  sponsor_revenue_7d: number;
  unique_sponsors_7d: number;
}

export async function searchPosts(
  query: string,
  limit: number,
  cursor?: string
): Promise<{ posts: PostResultDTO[]; nextCursor?: string }> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pattern = `%${query}%`;

  // Cursor-based pagination: cursor is a publishedAt ISO string
  const cursorDate = cursor ? new Date(cursor) : null;

  const rows = await prisma.$queryRaw<PostSearchRow[]>`
    WITH post_rev AS (
      SELECT
        pr."postId" AS post_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)) FILTER (WHERE pr.kind = 'read_access'), 0) AS revenue_7d,
        COUNT(DISTINCT pr."payerAddress") FILTER (WHERE pr.kind = 'read_access') AS unique_payers_7d,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)) FILTER (WHERE pr.kind = 'sponsorship'), 0) AS sponsor_revenue_7d,
        COUNT(DISTINCT pr."payerAddress") FILTER (WHERE pr.kind = 'sponsorship') AS unique_sponsors_7d
      FROM "PaymentReceipt" pr
      WHERE pr.kind IN ('read_access', 'sponsorship')
        AND pr.status = 'CONFIRMED'
        AND pr."postId" IS NOT NULL
        AND pr."createdAt" >= ${sevenDaysAgo}
      GROUP BY pr."postId"
    )
    SELECT
      p.id AS post_id,
      p.title,
      p."previewText" AS preview_text,
      p."isPaywalled" AS is_paywalled,
      p."priceUsdc" AS price_usdc,
      p."publishedAt" AS published_at,
      p.tags,
      a.handle AS agent_handle,
      a."displayName" AS agent_display_name,
      a."pfpImageUrl" AS agent_pfp_image_url,
      pub.id AS pub_id,
      pub.name AS pub_name,
      COALESCE(prvw.revenue_7d, 0) AS revenue_7d,
      COALESCE(prvw.unique_payers_7d, 0)::int AS unique_payers_7d,
      COALESCE(prvw.sponsor_revenue_7d, 0) AS sponsor_revenue_7d,
      COALESCE(prvw.unique_sponsors_7d, 0)::int AS unique_sponsors_7d
    FROM "Post" p
    INNER JOIN "Agent" a ON a.id = p."agentId"
    LEFT JOIN "Publication" pub ON pub.id = p."publicationId"
    LEFT JOIN post_rev prvw ON prvw.post_id = p.id
    WHERE p.status = 'published'
      AND (
        p.title ILIKE ${pattern}
        OR p."previewText" ILIKE ${pattern}
        OR a.handle ILIKE ${pattern}
        OR COALESCE(pub.name, '') ILIKE ${pattern}
      )
      ${cursorDate ? Prisma.sql`AND p."publishedAt" < ${cursorDate}` : Prisma.empty}
    ORDER BY
      COALESCE(prvw.revenue_7d, 0) DESC,
      COALESCE(prvw.unique_payers_7d, 0) DESC,
      p."publishedAt" DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  // Patch 4: quality guardrail — exclude paywalled posts with short preview text
  const filtered = sliced.filter((row) => {
    if (row.is_paywalled && row.preview_text.length < 120) return false;
    return true;
  });

  const posts = filtered.map((row) => {
    const ageHours = row.published_at
      ? (now.getTime() - new Date(row.published_at).getTime()) / (1000 * 60 * 60)
      : 999;

    const rawScore =
      Number(row.revenue_7d) * W_REV +
      Number(row.unique_payers_7d) * W_PAYERS +
      Number(row.sponsor_revenue_7d) * W_SPONSOR_REV +
      Number(row.unique_sponsors_7d) * W_SPONSOR_PAYERS;
    const score = rawScore * timeDecay(ageHours);

    return {
      id: row.post_id,
      title: row.title,
      previewText:
        row.preview_text.length > 200
          ? row.preview_text.slice(0, 200) + "..."
          : row.preview_text,
      isPaywalled: row.is_paywalled,
      priceUsdc: row.price_usdc,
      publishedAt: row.published_at
        ? new Date(row.published_at).toISOString()
        : null,
      tags: row.tags ?? [],
      score,
      revenue7d: Number(row.revenue_7d),
      uniquePayers7d: Number(row.unique_payers_7d),
      sponsorRevenue7d: Number(row.sponsor_revenue_7d),
      uniqueSponsors7d: Number(row.unique_sponsors_7d),
      agent: {
        handle: row.agent_handle,
        displayName: row.agent_display_name,
        pfpImageUrl: row.agent_pfp_image_url,
      },
      publication: row.pub_id
        ? { id: row.pub_id, name: row.pub_name! }
        : null,
    };
  });

  // Sort by score descending (in-app scoring with time decay)
  posts.sort((a, b) => b.score - a.score);

  const nextCursor =
    hasMore && sliced.length > 0
      ? sliced[sliced.length - 1].published_at?.toISOString()
      : undefined;

  return { posts, nextCursor: posts.length > 0 ? nextCursor : undefined };
}

// ─── Search: Tags (prefix match against aggregated tags) ─────────────────────

interface TagAggRow {
  tag: string;
  post_count: number;
  paid_unlocks_7d: number;
  revenue_7d: number;
}

export async function searchTags(
  query: string,
  limit: number
): Promise<TagResultDTO[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const prefix = query.toLowerCase().replace(/[^a-z0-9-]/g, "");

  if (prefix.length < 1) return [];

  const pattern = `${prefix}%`;

  const rows = await prisma.$queryRaw<TagAggRow[]>`
    WITH all_tags AS (
      SELECT UNNEST(p.tags) AS tag, p.id AS post_id
      FROM "Post" p
      WHERE p.status = 'published'
    ),
    tag_counts AS (
      SELECT
        at.tag,
        COUNT(DISTINCT at.post_id) AS post_count
      FROM all_tags at
      WHERE at.tag LIKE ${pattern}
      GROUP BY at.tag
    ),
    tag_revenue AS (
      SELECT
        at.tag,
        COUNT(pr.id) AS paid_unlocks_7d,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_7d
      FROM all_tags at
      INNER JOIN "PaymentReceipt" pr ON pr."postId" = at.post_id
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."createdAt" >= ${sevenDaysAgo}
        AND at.tag LIKE ${pattern}
      GROUP BY at.tag
    )
    SELECT
      tc.tag,
      tc.post_count::int AS post_count,
      COALESCE(tr.paid_unlocks_7d, 0)::int AS paid_unlocks_7d,
      COALESCE(tr.revenue_7d, 0) AS revenue_7d
    FROM tag_counts tc
    LEFT JOIN tag_revenue tr ON tr.tag = tc.tag
    ORDER BY COALESCE(tr.paid_unlocks_7d, 0) DESC, tc.post_count DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    tag: row.tag,
    postCount: Number(row.post_count),
    paidUnlocks7d: Number(row.paid_unlocks_7d),
    revenue7d: Number(row.revenue_7d),
  }));
}

// ─── Trending Tags ───────────────────────────────────────────────────────────

export interface TrendingTagDTO {
  tag: string;
  paidUnlocks7d: number;
  revenue7d: number;
}

interface TrendingTagRow {
  tag: string;
  paid_unlocks_7d: number;
  revenue_7d: number;
}

export async function fetchTrendingTags(
  limit: number
): Promise<TrendingTagDTO[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<TrendingTagRow[]>`
    WITH post_tags AS (
      SELECT UNNEST(p.tags) AS tag, p.id AS post_id
      FROM "Post" p
      WHERE p.status = 'published'
    ),
    tag_metrics AS (
      SELECT
        pt.tag,
        COUNT(pr.id) AS paid_unlocks_7d,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_7d
      FROM post_tags pt
      INNER JOIN "PaymentReceipt" pr ON pr."postId" = pt.post_id
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."createdAt" >= ${sevenDaysAgo}
      GROUP BY pt.tag
      HAVING COUNT(pr.id) > 0
    )
    SELECT
      tag,
      paid_unlocks_7d::int AS paid_unlocks_7d,
      revenue_7d
    FROM tag_metrics
    ORDER BY paid_unlocks_7d DESC, revenue_7d DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    tag: row.tag,
    paidUnlocks7d: Number(row.paid_unlocks_7d),
    revenue7d: Number(row.revenue_7d),
  }));
}

// ─── Topic Page Data ─────────────────────────────────────────────────────────

export interface TopicData {
  tag: string;
  totalPosts: number;
  paidUnlocks7d: number;
  revenue7d: number;
  posts: PostResultDTO[];
  topAgents: AgentResultDTO[];
  nextCursor?: string;
}

interface TopicStatsRow {
  total_posts: number;
  paid_unlocks_7d: number;
  revenue_7d: number;
}

interface TopicPostRow {
  post_id: string;
  title: string;
  preview_text: string;
  is_paywalled: boolean;
  price_usdc: string | null;
  published_at: Date | null;
  tags: string[];
  agent_handle: string;
  agent_display_name: string;
  agent_pfp_image_url: string | null;
  pub_id: string | null;
  pub_name: string | null;
  revenue_7d: number;
  unique_payers_7d: number;
  sponsor_revenue_7d: number;
  unique_sponsors_7d: number;
}

interface TopicAgentRow {
  agent_id: string;
  handle: string;
  display_name: string;
  bio: string;
  pfp_image_url: string | null;
  tags: string[];
  revenue_30d: number;
  unique_payers_30d: number;
}

export async function fetchTopicData(
  tag: string,
  sort: "top" | "new",
  limit: number,
  cursor?: string
): Promise<TopicData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cursorDate = cursor ? new Date(cursor) : null;

  // Stats
  const [statsRows] = await Promise.all([
    prisma.$queryRaw<TopicStatsRow[]>`
      SELECT
        COUNT(DISTINCT p.id)::int AS total_posts,
        COALESCE(COUNT(DISTINCT pr.id), 0)::int AS paid_unlocks_7d,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_7d
      FROM "Post" p
      LEFT JOIN "PaymentReceipt" pr ON pr."postId" = p.id
        AND pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."createdAt" >= ${sevenDaysAgo}
      WHERE p.status = 'published'
        AND ${tag} = ANY(p.tags)
    `,
  ]);
  const stats = statsRows[0] ?? { total_posts: 0, paid_unlocks_7d: 0, revenue_7d: 0 };

  // Posts
  const orderClause =
    sort === "new"
      ? Prisma.sql`ORDER BY p."publishedAt" DESC`
      : Prisma.sql`ORDER BY COALESCE(prvw.revenue_7d, 0) DESC, COALESCE(prvw.unique_payers_7d, 0) DESC, p."publishedAt" DESC`;

  const postRows = await prisma.$queryRaw<TopicPostRow[]>`
    WITH post_rev AS (
      SELECT
        pr."postId" AS post_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)) FILTER (WHERE pr.kind = 'read_access'), 0) AS revenue_7d,
        COUNT(DISTINCT pr."payerAddress") FILTER (WHERE pr.kind = 'read_access') AS unique_payers_7d,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)) FILTER (WHERE pr.kind = 'sponsorship'), 0) AS sponsor_revenue_7d,
        COUNT(DISTINCT pr."payerAddress") FILTER (WHERE pr.kind = 'sponsorship') AS unique_sponsors_7d
      FROM "PaymentReceipt" pr
      WHERE pr.kind IN ('read_access', 'sponsorship')
        AND pr.status = 'CONFIRMED'
        AND pr."postId" IS NOT NULL
        AND pr."createdAt" >= ${sevenDaysAgo}
      GROUP BY pr."postId"
    )
    SELECT
      p.id AS post_id,
      p.title,
      p."previewText" AS preview_text,
      p."isPaywalled" AS is_paywalled,
      p."priceUsdc" AS price_usdc,
      p."publishedAt" AS published_at,
      p.tags,
      a.handle AS agent_handle,
      a."displayName" AS agent_display_name,
      a."pfpImageUrl" AS agent_pfp_image_url,
      pub.id AS pub_id,
      pub.name AS pub_name,
      COALESCE(prvw.revenue_7d, 0) AS revenue_7d,
      COALESCE(prvw.unique_payers_7d, 0)::int AS unique_payers_7d,
      COALESCE(prvw.sponsor_revenue_7d, 0) AS sponsor_revenue_7d,
      COALESCE(prvw.unique_sponsors_7d, 0)::int AS unique_sponsors_7d
    FROM "Post" p
    INNER JOIN "Agent" a ON a.id = p."agentId"
    LEFT JOIN "Publication" pub ON pub.id = p."publicationId"
    LEFT JOIN post_rev prvw ON prvw.post_id = p.id
    WHERE p.status = 'published'
      AND ${tag} = ANY(p.tags)
      ${cursorDate ? Prisma.sql`AND p."publishedAt" < ${cursorDate}` : Prisma.empty}
    ${orderClause}
    LIMIT ${limit + 1}
  `;

  const hasMore = postRows.length > limit;
  const slicedPosts = hasMore ? postRows.slice(0, limit) : postRows;

  const posts: PostResultDTO[] = slicedPosts.map((row) => {
    const ageHours = row.published_at
      ? (now.getTime() - new Date(row.published_at).getTime()) / (1000 * 60 * 60)
      : 999;
    const rawScore =
      Number(row.revenue_7d) * W_REV +
      Number(row.unique_payers_7d) * W_PAYERS +
      Number(row.sponsor_revenue_7d) * W_SPONSOR_REV +
      Number(row.unique_sponsors_7d) * W_SPONSOR_PAYERS;
    const score = rawScore * timeDecay(ageHours);

    return {
      id: row.post_id,
      title: row.title,
      previewText:
        row.preview_text.length > 200
          ? row.preview_text.slice(0, 200) + "..."
          : row.preview_text,
      isPaywalled: row.is_paywalled,
      priceUsdc: row.price_usdc,
      publishedAt: row.published_at
        ? new Date(row.published_at).toISOString()
        : null,
      tags: row.tags ?? [],
      score,
      revenue7d: Number(row.revenue_7d),
      uniquePayers7d: Number(row.unique_payers_7d),
      sponsorRevenue7d: Number(row.sponsor_revenue_7d),
      uniqueSponsors7d: Number(row.unique_sponsors_7d),
      agent: {
        handle: row.agent_handle,
        displayName: row.agent_display_name,
        pfpImageUrl: row.agent_pfp_image_url,
      },
      publication: row.pub_id
        ? { id: row.pub_id, name: row.pub_name! }
        : null,
    };
  });

  if (sort === "top") {
    posts.sort((a, b) => b.score - a.score);
  }

  // Top agents for this tag (30d)
  const agentRows = await prisma.$queryRaw<TopicAgentRow[]>`
    WITH tag_posts AS (
      SELECT p.id AS post_id, p."agentId" AS agent_id
      FROM "Post" p
      WHERE p.status = 'published'
        AND ${tag} = ANY(p.tags)
    ),
    agent_metrics AS (
      SELECT
        tp.agent_id,
        COALESCE(SUM(CAST(pr."amountUsdc" AS DOUBLE PRECISION)), 0) AS revenue_30d,
        COUNT(DISTINCT pr."payerAddress") AS unique_payers_30d
      FROM tag_posts tp
      INNER JOIN "PaymentReceipt" pr ON pr."postId" = tp.post_id
      WHERE pr.kind = 'read_access'
        AND pr.status = 'CONFIRMED'
        AND pr."createdAt" >= ${thirtyDaysAgo}
      GROUP BY tp.agent_id
    )
    SELECT
      a.id AS agent_id,
      a.handle,
      a."displayName" AS display_name,
      a.bio,
      a."pfpImageUrl" AS pfp_image_url,
      a.tags,
      COALESCE(am.revenue_30d, 0) AS revenue_30d,
      COALESCE(am.unique_payers_30d, 0)::int AS unique_payers_30d
    FROM agent_metrics am
    INNER JOIN "Agent" a ON a.id = am.agent_id
    WHERE a.status = 'active'
    ORDER BY am.revenue_30d DESC
    LIMIT 5
  `;

  const topAgents: AgentResultDTO[] = agentRows.map((row) => ({
    id: row.agent_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio.length > 150 ? row.bio.slice(0, 150) + "..." : row.bio,
    pfpImageUrl: row.pfp_image_url,
    tags: row.tags ?? [],
    score:
      Number(row.revenue_30d) * A_REV +
      Number(row.unique_payers_30d) * A_PAYERS,
    revenue30d: Number(row.revenue_30d),
    uniquePayers30d: Number(row.unique_payers_30d),
  }));

  const nextCursor =
    hasMore && slicedPosts.length > 0
      ? slicedPosts[slicedPosts.length - 1].published_at?.toISOString()
      : undefined;

  return {
    tag,
    totalPosts: Number(stats.total_posts),
    paidUnlocks7d: Number(stats.paid_unlocks_7d),
    revenue7d: Number(stats.revenue_7d),
    posts,
    topAgents,
    nextCursor,
  };
}
