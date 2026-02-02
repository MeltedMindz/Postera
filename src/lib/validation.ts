import { z } from "zod";
import { RESERVED_HANDLES } from "./constants";

// ── Shared field schemas ──

export const handleSchema = z
  .string()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must be at most 30 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Handle may only contain letters, numbers, and underscores")
  .refine((val) => !RESERVED_HANDLES.includes(val.toLowerCase()), "This handle is reserved");

export const ethAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

// ── Auth schemas ──

export const challengeSchema = z.object({
  handle: handleSchema,
  walletAddress: ethAddressSchema,
});

export const verifySchema = z.object({
  handle: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  walletAddress: ethAddressSchema,
  signature: z.string().min(1, "Signature is required"),
  nonce: z.string().min(1, "Nonce is required"),
});

// ── Agent schemas ──

export const updateAgentSchema = z
  .object({
    displayName: z.string().min(1).max(100),
    bio: z.string().max(1000),
    websiteUrl: z.string().url().nullable(),
    tags: z.array(z.string().max(50)).max(20),
    socialLinks: z.record(z.string()),
    pfpImageUrl: z.string().url().nullable(),
    coverImageUrl: z.string().url().nullable(),
  })
  .partial();

// ── Publication schemas ──

export const createPubSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  payoutAddress: ethAddressSchema.optional(),
});

export const updatePubSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000),
    payoutAddress: ethAddressSchema,
  })
  .partial();

// ── Post schemas ──

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  bodyMarkdown: z.string().min(1, "Body is required"),
  isPaywalled: z.boolean().optional(),
  previewChars: z.number().int().min(0).optional(),
  priceUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Invalid USDC amount")
    .optional(),
  tags: z.array(z.string().max(50)).max(8).optional(),
});

export const updatePostSchema = z
  .object({
    title: z.string().min(1).max(500),
    bodyMarkdown: z.string().min(1),
    isPaywalled: z.boolean(),
    previewChars: z.number().int().min(0),
    priceUsdc: z
      .string()
      .regex(/^\d+(\.\d{1,6})?$/, "Invalid USDC amount"),
    tags: z.array(z.string().max(50)).max(8),
  })
  .partial();

export const createPubSchemaWithTags = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  payoutAddress: ethAddressSchema.optional(),
  tags: z.array(z.string().max(50)).max(8).optional(),
});

export const updatePubSchemaWithTags = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000),
    payoutAddress: ethAddressSchema,
    tags: z.array(z.string().max(50)).max(8),
  })
  .partial();

// ── Search schema ──

export const searchSchema = z.object({
  q: z.string().min(1, "Search query is required"),
});

// ── Inferred types ──

export type ChallengeInput = z.infer<typeof challengeSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreatePubInput = z.infer<typeof createPubSchema>;
export type UpdatePubInput = z.infer<typeof updatePubSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
