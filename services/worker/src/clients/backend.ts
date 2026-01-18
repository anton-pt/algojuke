/**
 * Backend GraphQL API Client
 *
 * Feature: ALG-84 - API Key Auth for Service-to-Service Communication
 *
 * Provides typed access to internal backend mutations for mix updates.
 * Uses service API key authentication via X-API-Key header.
 */

import axios from "axios";
import { createAPIError } from "./errors.js";
import {
  MixStatus,
  MixSegmentInput,
  MixResponse,
  UpdateMixStatusResponseSchema,
  UpdateMixSegmentsResponseSchema,
} from "../schemas/backend.js";

/**
 * Backend API URL from environment
 */
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

/**
 * Service API key from environment
 */
const SERVICE_API_KEY = process.env.SERVICE_API_KEY ?? "";

/**
 * Backend client configuration
 */
export interface BackendClientConfig {
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Backend client interface
 */
export interface BackendClient {
  /**
   * Update mix status (internal mutation)
   *
   * @param mixId - ID of the mix to update
   * @param status - New status (GENERATING, READY, FAILED)
   * @param failureReason - Error message if status is FAILED
   * @returns Updated mix
   * @throws APIError on failure
   */
  updateMixStatus(
    mixId: string,
    status: MixStatus,
    failureReason?: string,
  ): Promise<MixResponse>;

  /**
   * Update mix segments (internal mutation)
   *
   * @param mixId - ID of the mix to update
   * @param segments - Ordered list of segments
   * @param totalDurationMs - Total duration in milliseconds
   * @param characterCount - Total character count for voice segments
   * @returns Updated mix
   * @throws APIError on failure
   */
  updateMixSegments(
    mixId: string,
    segments: MixSegmentInput[],
    totalDurationMs: number,
    characterCount: number,
  ): Promise<MixResponse>;
}

/**
 * GraphQL mutation for updating mix status
 */
const UPDATE_MIX_STATUS_MUTATION = `
  mutation InternalUpdateMixStatus($mixId: ID!, $status: MixStatus!, $failureReason: String) {
    internalUpdateMixStatus(mixId: $mixId, status: $status, failureReason: $failureReason) {
      ... on Mix {
        __typename
        id
        title
        description
        status
        failureReason
        segments {
          ... on MusicSegment {
            __typename
            id
            type
            startMs
            endMs
            durationMs
            tidalTrackId
            isrc
            trackTitle
            artistName
            albumArtUrl
          }
          ... on VoiceSegment {
            __typename
            id
            type
            startMs
            endMs
            durationMs
            audioUrl
            sourceType
            sourceId
            sourceTitle
            sourceUrl
            contentMode
          }
        }
        totalDurationMs
        characterCount
        conversationId
        createdAt
        updatedAt
      }
      ... on MixError {
        __typename
        message
        code
        retryable
      }
    }
  }
`;

/**
 * GraphQL mutation for updating mix segments
 */
const UPDATE_MIX_SEGMENTS_MUTATION = `
  mutation InternalUpdateMixSegments($mixId: ID!, $segments: [MixSegmentInput!]!, $totalDurationMs: Int!, $characterCount: Int!) {
    internalUpdateMixSegments(mixId: $mixId, segments: $segments, totalDurationMs: $totalDurationMs, characterCount: $characterCount) {
      ... on Mix {
        __typename
        id
        title
        description
        status
        failureReason
        segments {
          ... on MusicSegment {
            __typename
            id
            type
            startMs
            endMs
            durationMs
            tidalTrackId
            isrc
            trackTitle
            artistName
            albumArtUrl
          }
          ... on VoiceSegment {
            __typename
            id
            type
            startMs
            endMs
            durationMs
            audioUrl
            sourceType
            sourceId
            sourceTitle
            sourceUrl
            contentMode
          }
        }
        totalDurationMs
        characterCount
        conversationId
        createdAt
        updatedAt
      }
      ... on MixError {
        __typename
        message
        code
        retryable
      }
    }
  }
`;

/**
 * Create Backend GraphQL API client
 *
 * @param config - Optional configuration overrides
 * @returns Backend client instance
 */
export function createBackendClient(
  config?: BackendClientConfig,
): BackendClient {
  const baseUrl = config?.baseUrl ?? BACKEND_API_URL;
  const apiKey = config?.apiKey ?? SERVICE_API_KEY;

  if (!apiKey) {
    throw new Error("SERVICE_API_KEY environment variable is not set");
  }

  const graphqlUrl = `${baseUrl}/graphql`;

  return {
    async updateMixStatus(
      mixId: string,
      status: MixStatus,
      failureReason?: string,
    ): Promise<MixResponse> {
      try {
        const response = await axios.post(
          graphqlUrl,
          {
            query: UPDATE_MIX_STATUS_MUTATION,
            variables: { mixId, status, failureReason },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            timeout: 30000, // 30 second timeout
            validateStatus: () => true, // Handle all status codes
          },
        );

        // Handle HTTP error status codes
        if (response.status >= 400) {
          throw createAPIError(
            response.status,
            "Backend",
            `Backend request failed: ${response.statusText}`,
          );
        }

        // Parse and validate response
        const parsed = UpdateMixStatusResponseSchema.safeParse(response.data);

        if (!parsed.success) {
          console.error(
            "Backend response validation failed:",
            parsed.error.message,
          );
          throw createAPIError(
            500,
            "Backend",
            `Invalid response from backend: ${parsed.error.message}`,
          );
        }

        // Check for GraphQL errors
        if (parsed.data.errors && parsed.data.errors.length > 0) {
          const error = parsed.data.errors[0];
          const code = error.extensions?.code as string | undefined;

          // UNAUTHENTICATED errors are not retryable
          if (code === "UNAUTHENTICATED") {
            throw createAPIError(401, "Backend", error.message);
          }

          throw createAPIError(500, "Backend", error.message);
        }

        // Check for null data
        if (!parsed.data.data) {
          throw createAPIError(500, "Backend", "No data in response");
        }

        const result = parsed.data.data.internalUpdateMixStatus;

        // Check for MixError result
        if (result.__typename === "MixError") {
          const statusCode = result.code === "NOT_FOUND" ? 404 : 500;
          throw createAPIError(statusCode, "Backend", result.message);
        }

        return result;
      } catch (error) {
        // Re-throw APIError as-is
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

        // Wrap axios errors
        if (axios.isAxiosError(error)) {
          throw createAPIError(
            error.response?.status ?? 500,
            "Backend",
            error.message,
          );
        }

        throw createAPIError(
          500,
          "Backend",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    },

    async updateMixSegments(
      mixId: string,
      segments: MixSegmentInput[],
      totalDurationMs: number,
      characterCount: number,
    ): Promise<MixResponse> {
      try {
        const response = await axios.post(
          graphqlUrl,
          {
            query: UPDATE_MIX_SEGMENTS_MUTATION,
            variables: { mixId, segments, totalDurationMs, characterCount },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            timeout: 30000, // 30 second timeout
            validateStatus: () => true, // Handle all status codes
          },
        );

        // Handle HTTP error status codes
        if (response.status >= 400) {
          throw createAPIError(
            response.status,
            "Backend",
            `Backend request failed: ${response.statusText}`,
          );
        }

        // Parse and validate response
        const parsed = UpdateMixSegmentsResponseSchema.safeParse(response.data);

        if (!parsed.success) {
          console.error(
            "Backend response validation failed:",
            parsed.error.message,
          );
          throw createAPIError(
            500,
            "Backend",
            `Invalid response from backend: ${parsed.error.message}`,
          );
        }

        // Check for GraphQL errors
        if (parsed.data.errors && parsed.data.errors.length > 0) {
          const error = parsed.data.errors[0];
          const code = error.extensions?.code as string | undefined;

          // UNAUTHENTICATED errors are not retryable
          if (code === "UNAUTHENTICATED") {
            throw createAPIError(401, "Backend", error.message);
          }

          throw createAPIError(500, "Backend", error.message);
        }

        // Check for null data
        if (!parsed.data.data) {
          throw createAPIError(500, "Backend", "No data in response");
        }

        const result = parsed.data.data.internalUpdateMixSegments;

        // Check for MixError result
        if (result.__typename === "MixError") {
          const statusCode = result.code === "NOT_FOUND" ? 404 : 500;
          throw createAPIError(statusCode, "Backend", result.message);
        }

        return result;
      } catch (error) {
        // Re-throw APIError as-is
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

        // Wrap axios errors
        if (axios.isAxiosError(error)) {
          throw createAPIError(
            error.response?.status ?? 500,
            "Backend",
            error.message,
          );
        }

        throw createAPIError(
          500,
          "Backend",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    },
  };
}
