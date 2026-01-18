/**
 * Zod schemas for Backend GraphQL Client
 *
 * Features:
 * - ALG-84: API Key Auth for Service-to-Service Communication
 * - ALG-85: Agent Tool GraphQL Queries for Mix Generation
 */

import { z } from "zod/v3";

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

// =============================================================================
// Agent Tool Schemas (ALG-85)
// =============================================================================

/**
 * Audio features from audio analysis
 */
export const AgentAudioFeaturesSchema = z.object({
  acousticness: z.number().nullable(),
  danceability: z.number().nullable(),
  energy: z.number().nullable(),
  instrumentalness: z.number().nullable(),
  key: z.number().nullable(),
  liveness: z.number().nullable(),
  loudness: z.number().nullable(),
  mode: z.number().nullable(),
  speechiness: z.number().nullable(),
  tempo: z.number().nullable(),
  valence: z.number().nullable(),
});
export type AgentAudioFeatures = z.infer<typeof AgentAudioFeaturesSchema>;

/**
 * Optimized track result from semantic search
 */
export const AgentOptimizedTrackSchema = z.object({
  isrc: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  artworkUrl: z.string().nullable(),
  duration: z.number().nullable(),
  inLibrary: z.boolean(),
  isIndexed: z.boolean(),
  score: z.number(),
  shortDescription: z.string().nullable(),
  audioFeatures: AgentAudioFeaturesSchema.nullable(),
});
export type AgentOptimizedTrack = z.infer<typeof AgentOptimizedTrackSchema>;

/**
 * Track result from Tidal search
 */
export const AgentTrackResultSchema = z.object({
  tidalId: z.string().nullable(),
  isrc: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  artworkUrl: z.string().nullable(),
  duration: z.number().nullable(),
  explicit: z.boolean().nullable(),
  inLibrary: z.boolean(),
  isIndexed: z.boolean(),
});
export type AgentTrackResult = z.infer<typeof AgentTrackResultSchema>;

/**
 * Album result from Tidal search
 */
export const AgentAlbumResultSchema = z.object({
  tidalId: z.string(),
  title: z.string(),
  artist: z.string(),
  artworkUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  trackCount: z.number(),
  inLibrary: z.boolean(),
});
export type AgentAlbumResult = z.infer<typeof AgentAlbumResultSchema>;

/**
 * Full indexed track result with metadata
 */
export const AgentIndexedTrackSchema = z.object({
  isrc: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  artworkUrl: z.string().nullable(),
  duration: z.number().nullable(),
  inLibrary: z.boolean(),
  isIndexed: z.boolean(),
  score: z.number(),
  lyrics: z.string().nullable(),
  interpretation: z.string().nullable(),
  shortDescription: z.string().nullable(),
  audioFeatures: AgentAudioFeaturesSchema.nullable(),
});
export type AgentIndexedTrack = z.infer<typeof AgentIndexedTrackSchema>;

/**
 * Semantic search response
 */
export const AgentSemanticSearchResponseSchema = z.object({
  __typename: z.literal("AgentSemanticSearchResponse"),
  tracks: z.array(AgentOptimizedTrackSchema),
  query: z.string(),
  totalFound: z.number(),
  summary: z.string(),
  durationMs: z.number(),
});
export type AgentSemanticSearchResponse = z.infer<
  typeof AgentSemanticSearchResponseSchema
>;

/**
 * Tidal search totals
 */
export const AgentTidalSearchTotalsSchema = z.object({
  tracks: z.number(),
  albums: z.number(),
});

/**
 * Tidal search response
 */
export const AgentTidalSearchResponseSchema = z.object({
  __typename: z.literal("AgentTidalSearchResponse"),
  tracks: z.array(AgentTrackResultSchema).nullable(),
  albums: z.array(AgentAlbumResultSchema).nullable(),
  query: z.string(),
  totalFound: AgentTidalSearchTotalsSchema,
  summary: z.string(),
  durationMs: z.number(),
});
export type AgentTidalSearchResponse = z.infer<
  typeof AgentTidalSearchResponseSchema
>;

/**
 * Batch metadata response
 */
export const AgentBatchMetadataResponseSchema = z.object({
  __typename: z.literal("AgentBatchMetadataResponse"),
  tracks: z.array(AgentIndexedTrackSchema),
  found: z.array(z.string()),
  notFound: z.array(z.string()),
  summary: z.string(),
  durationMs: z.number(),
});
export type AgentBatchMetadataResponse = z.infer<
  typeof AgentBatchMetadataResponseSchema
>;

/**
 * Agent tool error response
 */
export const AgentToolErrorSchema = z.object({
  __typename: z.literal("AgentToolError"),
  message: z.string(),
  code: z.string(),
  retryable: z.boolean(),
});
export type AgentToolError = z.infer<typeof AgentToolErrorSchema>;

/**
 * Union types for agent tool results
 */
export const AgentSemanticSearchResultSchema = z.discriminatedUnion(
  "__typename",
  [AgentSemanticSearchResponseSchema, AgentToolErrorSchema],
);
export type AgentSemanticSearchResult = z.infer<
  typeof AgentSemanticSearchResultSchema
>;

export const AgentTidalSearchResultSchema = z.discriminatedUnion("__typename", [
  AgentTidalSearchResponseSchema,
  AgentToolErrorSchema,
]);
export type AgentTidalSearchResult = z.infer<
  typeof AgentTidalSearchResultSchema
>;

export const AgentBatchMetadataResultSchema = z.discriminatedUnion(
  "__typename",
  [AgentBatchMetadataResponseSchema, AgentToolErrorSchema],
);
export type AgentBatchMetadataResult = z.infer<
  typeof AgentBatchMetadataResultSchema
>;

/**
 * Readwise document schema
 */
export const ReadwiseDocumentSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  source: z.string(),
  category: z.string(),
  location: z.string(),
  wordCount: z.number().nullable(),
  readingTimeMinutes: z.number().nullable(),
  publishedAt: z.string().nullable(),
  savedAt: z.string(),
  tags: z.array(z.string()),
});
export type ReadwiseDocument = z.infer<typeof ReadwiseDocumentSchema>;

/**
 * Readwise fetch response
 */
export const AgentReadwiseFetchResponseSchema = z.object({
  __typename: z.literal("AgentReadwiseFetchResponse"),
  document: ReadwiseDocumentSchema,
  content: z.string(),
  contentMode: z.enum(["summary", "full"]),
  summary: z.string(),
  durationMs: z.number(),
});
export type AgentReadwiseFetchResponse = z.infer<
  typeof AgentReadwiseFetchResponseSchema
>;

export const AgentReadwiseFetchResultSchema = z.discriminatedUnion(
  "__typename",
  [AgentReadwiseFetchResponseSchema, AgentToolErrorSchema],
);
export type AgentReadwiseFetchResult = z.infer<
  typeof AgentReadwiseFetchResultSchema
>;

// =============================================================================
// GraphQL Response Wrappers for Agent Tools
// =============================================================================

export const AgentSemanticSearchGraphQLResponseSchema = z.object({
  data: z
    .object({
      agentSemanticSearch: AgentSemanticSearchResultSchema,
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

export const AgentTidalSearchGraphQLResponseSchema = z.object({
  data: z
    .object({
      agentTidalSearch: AgentTidalSearchResultSchema,
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

export const AgentBatchMetadataGraphQLResponseSchema = z.object({
  data: z
    .object({
      agentBatchMetadata: AgentBatchMetadataResultSchema,
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

export const AgentReadwiseFetchGraphQLResponseSchema = z.object({
  data: z
    .object({
      agentReadwiseFetch: AgentReadwiseFetchResultSchema,
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
