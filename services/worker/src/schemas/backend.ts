/**
 * Zod schemas for Backend GraphQL Client
 *
 * Feature: ALG-84 - API Key Auth for Service-to-Service Communication
 */

import { z } from "zod";

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Mix status values (maps to GraphQL MixStatus enum)
 */
export const MixStatusSchema = z.enum(["GENERATING", "READY", "FAILED"]);
export type MixStatus = z.infer<typeof MixStatusSchema>;

/**
 * Segment type values (maps to GraphQL SegmentType enum)
 */
export const SegmentTypeSchema = z.enum(["MUSIC", "VOICE"]);
export type SegmentType = z.infer<typeof SegmentTypeSchema>;

/**
 * Mix segment input (maps to GraphQL MixSegmentInput)
 */
export const MixSegmentInputSchema = z.object({
  id: z.string(),
  type: SegmentTypeSchema,
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  // Music segment fields (optional)
  tidalTrackId: z.string().optional(),
  isrc: z.string().optional(),
  trackTitle: z.string().optional(),
  artistName: z.string().optional(),
  albumArtUrl: z.string().optional(),
  // Voice segment fields (optional)
  audioUrl: z.string().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceUrl: z.string().optional(),
  contentMode: z.string().optional(),
});
export type MixSegmentInput = z.infer<typeof MixSegmentInputSchema>;

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * Music segment response
 */
export const MusicSegmentSchema = z.object({
  __typename: z.literal("MusicSegment"),
  id: z.string(),
  type: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  durationMs: z.number(),
  tidalTrackId: z.string().nullable(),
  isrc: z.string().nullable(),
  trackTitle: z.string().nullable(),
  artistName: z.string().nullable(),
  albumArtUrl: z.string().nullable(),
});

/**
 * Voice segment response
 */
export const VoiceSegmentSchema = z.object({
  __typename: z.literal("VoiceSegment"),
  id: z.string(),
  type: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  durationMs: z.number(),
  audioUrl: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  contentMode: z.string().nullable(),
});

/**
 * Mix segment response (union)
 */
export const MixSegmentResponseSchema = z.discriminatedUnion("__typename", [
  MusicSegmentSchema,
  VoiceSegmentSchema,
]);
export type MixSegmentResponse = z.infer<typeof MixSegmentResponseSchema>;

/**
 * Mix response from GraphQL
 */
export const MixResponseSchema = z.object({
  __typename: z.literal("Mix"),
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: MixStatusSchema,
  failureReason: z.string().nullable(),
  segments: z.array(MixSegmentResponseSchema),
  totalDurationMs: z.number(),
  characterCount: z.number(),
  conversationId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MixResponse = z.infer<typeof MixResponseSchema>;

/**
 * Mix error response
 */
export const MixErrorResponseSchema = z.object({
  __typename: z.literal("MixError"),
  message: z.string(),
  code: z.enum([
    "NOT_FOUND",
    "UNAUTHORIZED",
    "DATABASE_ERROR",
    "INTERNAL_ERROR",
  ]),
  retryable: z.boolean(),
});
export type MixErrorResponse = z.infer<typeof MixErrorResponseSchema>;

/**
 * Internal mix result union
 */
export const InternalMixResultSchema = z.discriminatedUnion("__typename", [
  MixResponseSchema,
  MixErrorResponseSchema,
]);
export type InternalMixResult = z.infer<typeof InternalMixResultSchema>;

/**
 * GraphQL response wrapper for internalUpdateMixStatus
 */
export const UpdateMixStatusResponseSchema = z.object({
  data: z
    .object({
      internalUpdateMixStatus: InternalMixResultSchema,
    })
    .nullable(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        locations: z
          .array(z.object({ line: z.number(), column: z.number() }))
          .optional(),
        path: z.array(z.union([z.string(), z.number()])).optional(),
        extensions: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});
export type UpdateMixStatusResponse = z.infer<
  typeof UpdateMixStatusResponseSchema
>;

/**
 * GraphQL response wrapper for internalUpdateMixSegments
 */
export const UpdateMixSegmentsResponseSchema = z.object({
  data: z
    .object({
      internalUpdateMixSegments: InternalMixResultSchema,
    })
    .nullable(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        locations: z
          .array(z.object({ line: z.number(), column: z.number() }))
          .optional(),
        path: z.array(z.union([z.string(), z.number()])).optional(),
        extensions: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});
export type UpdateMixSegmentsResponse = z.infer<
  typeof UpdateMixSegmentsResponseSchema
>;
