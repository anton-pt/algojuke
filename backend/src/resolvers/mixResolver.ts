/**
 * Mix GraphQL Resolvers
 *
 * Handles GraphQL queries and mutations for radio mix management.
 * Mix generation is triggered via agent tools (generateMix) in the worker service.
 */

import { MixService } from "../services/mixService.js";
import { Mix, MixSegment, MixStatus } from "../entities/Mix.js";
import { logger } from "../utils/logger.js";
import { requireAuth, type GraphQLContext } from "../middleware/authGuard.js";
import { requireServiceAuth } from "../middleware/serviceAuth.js";

/**
 * GraphQL context with mix service
 */
export interface MixContext extends GraphQLContext {
  mixService: MixService;
  serviceApiKey?: string;
}

/**
 * Error codes for mix operations
 */
type MixErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

/**
 * Mix error type for GraphQL
 */
interface MixError {
  __typename: "MixError";
  message: string;
  code: MixErrorCode;
  retryable: boolean;
}

/**
 * GraphQL MusicSegment type
 */
interface GraphQLMusicSegment {
  __typename: "MusicSegment";
  id: string;
  type: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  tidalTrackId: string | null;
  isrc: string | null;
  trackTitle: string | null;
  artistName: string | null;
  albumArtUrl: string | null;
}

/**
 * GraphQL VoiceSegment type
 */
interface GraphQLVoiceSegment {
  __typename: "VoiceSegment";
  id: string;
  type: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  audioUrl: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  contentMode: string | null;
}

type GraphQLMixSegment = GraphQLMusicSegment | GraphQLVoiceSegment;

/**
 * GraphQL Mix type
 */
interface GraphQLMix {
  __typename: "Mix";
  id: string;
  title: string;
  description: string | null;
  status: "GENERATING" | "READY" | "FAILED";
  failureReason: string | null;
  segments: GraphQLMixSegment[];
  totalDurationMs: number;
  characterCount: number;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mix list result
 */
interface MixList {
  __typename: "MixList";
  mixes: GraphQLMix[];
  totalCount: number;
}

/**
 * Delete success result
 */
interface DeleteMixSuccess {
  __typename: "DeleteMixSuccess";
  deletedId: string;
  message: string;
}

/**
 * Transform MixSegment entity to GraphQL type
 */
function toGraphQLSegment(segment: MixSegment): GraphQLMixSegment {
  if (segment.type === "music") {
    return {
      __typename: "MusicSegment",
      id: segment.id,
      type: segment.type,
      startMs: segment.startMs,
      endMs: segment.endMs,
      durationMs: segment.durationMs,
      tidalTrackId: segment.tidalTrackId ?? null,
      isrc: segment.isrc ?? null,
      trackTitle: segment.trackTitle ?? null,
      artistName: segment.artistName ?? null,
      albumArtUrl: segment.albumArtUrl ?? null,
    };
  } else {
    return {
      __typename: "VoiceSegment",
      id: segment.id,
      type: segment.type,
      startMs: segment.startMs,
      endMs: segment.endMs,
      durationMs: segment.durationMs,
      audioUrl: segment.audioUrl ?? null,
      sourceType: segment.sourceType ?? null,
      sourceId: segment.sourceId ?? null,
      sourceTitle: segment.sourceTitle ?? null,
      sourceUrl: segment.sourceUrl ?? null,
      contentMode: segment.contentMode ?? null,
    };
  }
}

/**
 * Map entity status to GraphQL enum value
 */
function toGraphQLStatus(
  status: "generating" | "ready" | "failed",
): "GENERATING" | "READY" | "FAILED" {
  const statusMap = {
    generating: "GENERATING" as const,
    ready: "READY" as const,
    failed: "FAILED" as const,
  };
  return statusMap[status];
}

/**
 * Transform Mix entity for GraphQL response
 */
function toGraphQLMix(mix: Mix): GraphQLMix {
  return {
    __typename: "Mix",
    id: mix.id,
    title: mix.title,
    description: mix.description,
    status: toGraphQLStatus(mix.status),
    failureReason: mix.failureReason,
    segments: mix.segments.map(toGraphQLSegment),
    totalDurationMs: mix.totalDurationMs,
    characterCount: mix.characterCount,
    conversationId: mix.conversationId,
    createdAt: mix.createdAt.toISOString(),
    updatedAt: mix.updatedAt.toISOString(),
  };
}

/**
 * GraphQL segment input type
 */
interface GraphQLSegmentInput {
  id: string;
  type: "MUSIC" | "VOICE";
  startMs: number;
  endMs: number;
  durationMs: number;
  // Music fields (optional)
  tidalTrackId?: string;
  isrc?: string;
  trackTitle?: string;
  artistName?: string;
  albumArtUrl?: string;
  // Voice fields (optional)
  audioUrl?: string;
  sourceType?: string;
  sourceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  contentMode?: string;
}

/**
 * Create error response
 */
function createError(
  message: string,
  code: MixErrorCode,
  retryable: boolean,
): MixError {
  return {
    __typename: "MixError",
    message,
    code,
    retryable,
  };
}

/**
 * Map GraphQL status enum to entity status
 */
function graphQLStatusToEntity(status: string): MixStatus {
  const statusMap: Record<string, MixStatus> = {
    GENERATING: "generating",
    READY: "ready",
    FAILED: "failed",
  };
  return statusMap[status] ?? "generating";
}

/**
 * Convert GraphQL segment input to entity format
 */
function graphQLSegmentToEntity(segment: GraphQLSegmentInput): MixSegment {
  const base = {
    id: segment.id,
    type: segment.type === "MUSIC" ? ("music" as const) : ("voice" as const),
    startMs: segment.startMs,
    endMs: segment.endMs,
    durationMs: segment.durationMs,
  };

  if (segment.type === "MUSIC") {
    return {
      ...base,
      type: "music",
      tidalTrackId: segment.tidalTrackId,
      isrc: segment.isrc,
      trackTitle: segment.trackTitle,
      artistName: segment.artistName,
      albumArtUrl: segment.albumArtUrl,
    };
  } else {
    return {
      ...base,
      type: "voice",
      audioUrl: segment.audioUrl,
      sourceType: segment.sourceType as
        | "article"
        | "highlight"
        | "newsletter"
        | undefined,
      sourceId: segment.sourceId,
      sourceTitle: segment.sourceTitle,
      sourceUrl: segment.sourceUrl,
      contentMode: segment.contentMode as
        | "summary"
        | "excerpt"
        | "full"
        | undefined,
    };
  }
}

export const mixResolvers = {
  Query: {
    /**
     * List all mixes for the current user
     */
    mixes: async (
      _: unknown,
      __: unknown,
      context: MixContext,
    ): Promise<MixList | MixError> => {
      try {
        requireAuth(context, "mixes");
      } catch {
        return createError("Authentication required", "UNAUTHORIZED", false);
      }

      try {
        const mixes = await context.mixService.getMixesByUser(context.userId);

        return {
          __typename: "MixList",
          mixes: mixes.map(toGraphQLMix),
          totalCount: mixes.length,
        };
      } catch (error) {
        logger.error("mix_list_error", {
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          "Failed to load mixes. Please try again.",
          "DATABASE_ERROR",
          true,
        );
      }
    },

    /**
     * Get a single mix by ID
     */
    mix: async (
      _: unknown,
      { id }: { id: string },
      context: MixContext,
    ): Promise<GraphQLMix | MixError> => {
      try {
        requireAuth(context, "mix");
      } catch {
        return createError("Authentication required", "UNAUTHORIZED", false);
      }

      try {
        const mix = await context.mixService.getMix(id, context.userId);

        if (!mix) {
          return createError("Mix not found", "NOT_FOUND", false);
        }

        return toGraphQLMix(mix);
      } catch (error) {
        logger.error("mix_get_error", {
          mixId: id,
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          "Failed to load mix. Please try again.",
          "DATABASE_ERROR",
          true,
        );
      }
    },
  },

  Mutation: {
    /**
     * Delete a mix by ID
     */
    deleteMix: async (
      _: unknown,
      { id }: { id: string },
      context: MixContext,
    ): Promise<DeleteMixSuccess | MixError> => {
      try {
        requireAuth(context, "deleteMix");
      } catch {
        return createError("Authentication required", "UNAUTHORIZED", false);
      }

      try {
        const deleted = await context.mixService.deleteMix(id, context.userId);

        if (!deleted) {
          return createError("Mix not found", "NOT_FOUND", false);
        }

        logger.info("mix_deleted", { mixId: id });

        return {
          __typename: "DeleteMixSuccess",
          deletedId: id,
          message: "Mix deleted successfully",
        };
      } catch (error) {
        logger.error("mix_delete_error", {
          mixId: id,
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          "Failed to delete mix. Please try again.",
          "DATABASE_ERROR",
          true,
        );
      }
    },

    // =========================================================================
    // Internal mutations (service auth only)
    // =========================================================================

    /**
     * Update mix status (internal use only - requires service API key)
     */
    internalUpdateMixStatus: async (
      _: unknown,
      {
        mixId,
        status,
        failureReason,
      }: { mixId: string; status: string; failureReason?: string },
      context: MixContext,
    ): Promise<GraphQLMix | MixError> => {
      try {
        requireServiceAuth(context, "internalUpdateMixStatus");
      } catch {
        return createError(
          "Service authentication required",
          "UNAUTHORIZED",
          false,
        );
      }

      try {
        // Map GraphQL enum to entity status
        const entityStatus = graphQLStatusToEntity(status);

        const mix = await context.mixService.updateMixStatusInternal(
          mixId,
          entityStatus,
          failureReason,
        );

        if (!mix) {
          return createError("Mix not found", "NOT_FOUND", false);
        }

        logger.info("internal_mix_status_updated", {
          mixId,
          status: entityStatus,
        });

        return toGraphQLMix(mix);
      } catch (error) {
        logger.error("internal_mix_status_update_error", {
          mixId,
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          "Failed to update mix status. Please try again.",
          "DATABASE_ERROR",
          true,
        );
      }
    },

    /**
     * Update mix segments (internal use only - requires service API key)
     */
    internalUpdateMixSegments: async (
      _: unknown,
      {
        mixId,
        segments,
        totalDurationMs,
        characterCount,
      }: {
        mixId: string;
        segments: GraphQLSegmentInput[];
        totalDurationMs: number;
        characterCount: number;
      },
      context: MixContext,
    ): Promise<GraphQLMix | MixError> => {
      try {
        requireServiceAuth(context, "internalUpdateMixSegments");
      } catch {
        return createError(
          "Service authentication required",
          "UNAUTHORIZED",
          false,
        );
      }

      try {
        // Convert GraphQL segment input to entity format
        const entitySegments = segments.map(graphQLSegmentToEntity);

        const mix = await context.mixService.updateMixSegmentsInternal(
          mixId,
          entitySegments,
          totalDurationMs,
          characterCount,
        );

        if (!mix) {
          return createError("Mix not found", "NOT_FOUND", false);
        }

        logger.info("internal_mix_segments_updated", {
          mixId,
          segmentCount: segments.length,
          totalDurationMs,
          characterCount,
        });

        return toGraphQLMix(mix);
      } catch (error) {
        logger.error("internal_mix_segments_update_error", {
          mixId,
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          "Failed to update mix segments. Please try again.",
          "DATABASE_ERROR",
          true,
        );
      }
    },
  },

  // Union type resolvers
  MixesResult: {
    __resolveType(obj: MixList | MixError) {
      return obj.__typename;
    },
  },

  MixResult: {
    __resolveType(obj: GraphQLMix | MixError) {
      return obj.__typename;
    },
  },

  DeleteMixResult: {
    __resolveType(obj: DeleteMixSuccess | MixError) {
      return obj.__typename;
    },
  },

  InternalMixResult: {
    __resolveType(obj: GraphQLMix | MixError) {
      return obj.__typename;
    },
  },

  MixSegment: {
    __resolveType(obj: GraphQLMixSegment) {
      return obj.__typename;
    },
  },
};
