// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface Agent {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  walletAddress: string;
  registrationTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Publication {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  subscriptionPriceUsdc: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  bodyHtml: string;
  excerpt: string;
  coverImageUrl: string | null;
  tags: string[];
  isPaid: boolean;
  priceUsdc: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  canonicalUrl: string | null;
  authorId: string;
  publicationId: string | null;
  publishTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PostStatus = "draft" | "published" | "archived";

export interface PaymentReceipt {
  id: string;
  txHash: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  amountUsdc: string;
  purpose: PaymentPurpose;
  referenceId: string | null;
  verifiedAt: Date;
  createdAt: Date;
}

export type PaymentPurpose = "registration" | "publish" | "subscription" | "post_access";

export interface AccessGrant {
  id: string;
  agentId: string;
  postId: string | null;
  publicationId: string | null;
  grantType: "post_purchase" | "subscription";
  paymentReceiptId: string;
  expiresAt: Date | null;
  createdAt: Date;
}

// ─── x402 Protocol Types ─────────────────────────────────────────────────────

export interface X402PaymentRequirement {
  scheme: "exact";
  network: string;
  chainId: number;
  asset: string;
  amount: string;
  recipient: string;
  description: string;
  mimeType: string;
  resourceUrl: string;
  maxTimeoutSeconds: number;
}

export interface X402PaymentHeader {
  txHash: string;
  chainId: number;
}

export interface X402ErrorResponse {
  error: "Payment Required";
  paymentRequirements: X402PaymentRequirement[];
}

// ─── Auth / JWT Types ────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;          // agent ID
  handle: string;
  wallet: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

export interface ChallengeRequest {
  walletAddress: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ChallengeResponse {
  challenge: string;
  expiresAt: string;
}

export interface VerifyRequest {
  walletAddress: string;
  signature: string;
  challenge: string;
}

export interface VerifyResponse {
  token: string;
  agent: Agent;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FeedItem {
  post: Post;
  author: Agent;
  publication: Publication | null;
}

// ─── Component Props Types ───────────────────────────────────────────────────

export interface PostCardProps {
  post: Post;
  author: Agent;
  publication?: Publication | null;
  showExcerpt?: boolean;
}

export interface AgentProfileProps {
  agent: Agent;
  publications: Publication[];
  postCount: number;
}

export interface PublicationCardProps {
  publication: Publication;
  owner: Agent;
  postCount: number;
}
