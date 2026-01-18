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
  AgentSemanticSearchResponse,
  AgentTidalSearchResponse,
  AgentBatchMetadataResponse,
  AgentReadwiseFetchResponse,
  AgentSemanticSearchGraphQLResponseSchema,
  AgentTidalSearchGraphQLResponseSchema,
  AgentBatchMetadataGraphQLResponseSchema,
  AgentReadwiseFetchGraphQLResponseSchema,
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
 * Tidal search type
 */
export type TidalSearchType = "tracks" | "albums" | "both";

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

  // =========================================================================
  // Agent Tool Methods (ALG-85)
  // =========================================================================

  /**
   * Semantic search for tracks by mood/theme
   *
   * @param query - Natural language search query
   * @param userId - User ID for library status
   * @param limit - Max results (default 50)
   * @returns Search results with tracks
   * @throws APIError on failure
   */
  semanticSearch(
    query: string,
    userId: string,
    limit?: number,
  ): Promise<AgentSemanticSearchResponse>;

  /**
   * Search Tidal catalogue
   *
   * @param query - Search query
   * @param searchType - What to search (tracks, albums, both)
   * @param userId - User ID for library status
   * @param limit - Max results per type (default 20)
   * @returns Search results with tracks and/or albums
   * @throws APIError on failure
   */
  tidalSearch(
    query: string,
    searchType: TidalSearchType,
    userId: string,
    limit?: number,
  ): Promise<AgentTidalSearchResponse>;

  /**
   * Get full metadata for tracks by ISRC
   *
   * @param isrcs - Array of ISRCs to look up
   * @param userId - User ID for library status
   * @returns Full track metadata
   * @throws APIError on failure
   */
  batchMetadata(
    isrcs: string[],
    userId: string,
  ): Promise<AgentBatchMetadataResponse>;

  /**
   * Fetch Readwise document content
   *
   * @param documentId - Readwise document ID
   * @param contentMode - How to process content (summary, full)
   * @param userId - User ID for Readwise auth
   * @param summaryLength - Length for summary mode (short, medium, long)
   * @returns Document with processed content
   * @throws APIError on failure
   */
  readwiseFetch(
    documentId: string,
    contentMode: "summary" | "full",
    userId: string,
    summaryLength?: "short" | "medium" | "long",
  ): Promise<AgentReadwiseFetchResponse>;
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

// =============================================================================
// Agent Tool GraphQL Queries (ALG-85)
// =============================================================================

/**
 * GraphQL query for semantic search
 */
const AGENT_SEMANTIC_SEARCH_QUERY = `
  query AgentSemanticSearch($input: AgentSemanticSearchInput!) {
    agentSemanticSearch(input: $input) {
      ... on AgentSemanticSearchResponse {
        __typename
        tracks {
          isrc
          title
          artist
          album
          artworkUrl
          duration
          inLibrary
          isIndexed
          score
          shortDescription
          audioFeatures {
            acousticness
            danceability
            energy
            instrumentalness
            key
            liveness
            loudness
            mode
            speechiness
            tempo
            valence
          }
        }
        query
        totalFound
        summary
        durationMs
      }
      ... on AgentToolError {
        __typename
        message
        code
        retryable
      }
    }
  }
`;

/**
 * GraphQL query for Tidal search
 */
const AGENT_TIDAL_SEARCH_QUERY = `
  query AgentTidalSearch($input: AgentTidalSearchInput!) {
    agentTidalSearch(input: $input) {
      ... on AgentTidalSearchResponse {
        __typename
        tracks {
          tidalId
          isrc
          title
          artist
          album
          artworkUrl
          duration
          explicit
          inLibrary
          isIndexed
        }
        albums {
          tidalId
          title
          artist
          artworkUrl
          releaseDate
          trackCount
          inLibrary
        }
        query
        totalFound {
          tracks
          albums
        }
        summary
        durationMs
      }
      ... on AgentToolError {
        __typename
        message
        code
        retryable
      }
    }
  }
`;

/**
 * GraphQL query for batch metadata
 */
const AGENT_BATCH_METADATA_QUERY = `
  query AgentBatchMetadata($input: AgentBatchMetadataInput!) {
    agentBatchMetadata(input: $input) {
      ... on AgentBatchMetadataResponse {
        __typename
        tracks {
          isrc
          title
          artist
          album
          artworkUrl
          duration
          inLibrary
          isIndexed
          score
          lyrics
          interpretation
          shortDescription
          audioFeatures {
            acousticness
            danceability
            energy
            instrumentalness
            key
            liveness
            loudness
            mode
            speechiness
            tempo
            valence
          }
        }
        found
        notFound
        summary
        durationMs
      }
      ... on AgentToolError {
        __typename
        message
        code
        retryable
      }
    }
  }
`;

/**
 * GraphQL query for Readwise fetch
 */
const AGENT_READWISE_FETCH_QUERY = `
  query AgentReadwiseFetch($input: AgentReadwiseFetchInput!) {
    agentReadwiseFetch(input: $input) {
      ... on AgentReadwiseFetchResponse {
        __typename
        document {
          id
          url
          title
          author
          source
          category
          location
          wordCount
          readingTimeMinutes
          publishedAt
          savedAt
          tags
        }
        content
        contentMode
        summary
        durationMs
      }
      ... on AgentToolError {
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

    // =========================================================================
    // Agent Tool Methods (ALG-85)
    // =========================================================================

    async semanticSearch(
      query: string,
      userId: string,
      limit: number = 50,
    ): Promise<AgentSemanticSearchResponse> {
      try {
        const response = await axios.post(
          graphqlUrl,
          {
            query: AGENT_SEMANTIC_SEARCH_QUERY,
            variables: {
              input: { query, limit, userId },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            timeout: 60000, // 60 second timeout for search
            validateStatus: () => true,
          },
        );

        if (response.status >= 400) {
          throw createAPIError(
            response.status,
            "Backend",
            `Semantic search failed: ${response.statusText}`,
          );
        }

        const parsed = AgentSemanticSearchGraphQLResponseSchema.safeParse(
          response.data,
        );

        if (!parsed.success) {
          throw createAPIError(
            500,
            "Backend",
            `Invalid semantic search response: ${parsed.error.message}`,
          );
        }

        if (parsed.data.errors && parsed.data.errors.length > 0) {
          throw createAPIError(500, "Backend", parsed.data.errors[0].message);
        }

        if (!parsed.data.data) {
          throw createAPIError(
            500,
            "Backend",
            "No data in semantic search response",
          );
        }

        const result = parsed.data.data.agentSemanticSearch;

        if (result.__typename === "AgentToolError") {
          const statusCode = result.code === "NOT_FOUND" ? 404 : 500;
          throw createAPIError(statusCode, "Backend", result.message);
        }

        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

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

    async tidalSearch(
      query: string,
      searchType: TidalSearchType,
      userId: string,
      limit: number = 20,
    ): Promise<AgentTidalSearchResponse> {
      try {
        const response = await axios.post(
          graphqlUrl,
          {
            query: AGENT_TIDAL_SEARCH_QUERY,
            variables: {
              input: { query, searchType, limit, userId },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            timeout: 60000,
            validateStatus: () => true,
          },
        );

        if (response.status >= 400) {
          throw createAPIError(
            response.status,
            "Backend",
            `Tidal search failed: ${response.statusText}`,
          );
        }

        const parsed = AgentTidalSearchGraphQLResponseSchema.safeParse(
          response.data,
        );

        if (!parsed.success) {
          throw createAPIError(
            500,
            "Backend",
            `Invalid Tidal search response: ${parsed.error.message}`,
          );
        }

        if (parsed.data.errors && parsed.data.errors.length > 0) {
          throw createAPIError(500, "Backend", parsed.data.errors[0].message);
        }

        if (!parsed.data.data) {
          throw createAPIError(
            500,
            "Backend",
            "No data in Tidal search response",
          );
        }

        const result = parsed.data.data.agentTidalSearch;

        if (result.__typename === "AgentToolError") {
          const statusCode = result.code === "NOT_FOUND" ? 404 : 500;
          throw createAPIError(statusCode, "Backend", result.message);
        }

        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

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

    async batchMetadata(
      isrcs: string[],
      userId: string,
    ): Promise<AgentBatchMetadataResponse> {
      try {
        const response = await axios.post(
          graphqlUrl,
          {
            query: AGENT_BATCH_METADATA_QUERY,
            variables: {
              input: { isrcs, userId },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            timeout: 60000,
            validateStatus: () => true,
          },
        );

        if (response.status >= 400) {
          throw createAPIError(
            response.status,
            "Backend",
            `Batch metadata failed: ${response.statusText}`,
          );
        }

        const parsed = AgentBatchMetadataGraphQLResponseSchema.safeParse(
          response.data,
        );

        if (!parsed.success) {
          throw createAPIError(
            500,
            "Backend",
            `Invalid batch metadata response: ${parsed.error.message}`,
          );
        }

        if (parsed.data.errors && parsed.data.errors.length > 0) {
          throw createAPIError(500, "Backend", parsed.data.errors[0].message);
        }

        if (!parsed.data.data) {
          throw createAPIError(
            500,
            "Backend",
            "No data in batch metadata response",
          );
        }

        const result = parsed.data.data.agentBatchMetadata;

        if (result.__typename === "AgentToolError") {
          const statusCode = result.code === "NOT_FOUND" ? 404 : 500;
          throw createAPIError(statusCode, "Backend", result.message);
        }

        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

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

    async readwiseFetch(
      documentId: string,
      contentMode: "summary" | "full",
      userId: string,
      summaryLength: "short" | "medium" | "long" = "medium",
    ): Promise<AgentReadwiseFetchResponse> {
      try {
        const response = await axios.post(
          graphqlUrl,
          {
            query: AGENT_READWISE_FETCH_QUERY,
            variables: {
              input: { documentId, contentMode, summaryLength, userId },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            timeout: 120000, // 2 minute timeout for LLM processing
            validateStatus: () => true,
          },
        );

        if (response.status >= 400) {
          throw createAPIError(
            response.status,
            "Backend",
            `Readwise fetch failed: ${response.statusText}`,
          );
        }

        const parsed = AgentReadwiseFetchGraphQLResponseSchema.safeParse(
          response.data,
        );

        if (!parsed.success) {
          throw createAPIError(
            500,
            "Backend",
            `Invalid Readwise fetch response: ${parsed.error.message}`,
          );
        }

        if (parsed.data.errors && parsed.data.errors.length > 0) {
          throw createAPIError(500, "Backend", parsed.data.errors[0].message);
        }

        if (!parsed.data.data) {
          throw createAPIError(
            500,
            "Backend",
            "No data in Readwise fetch response",
          );
        }

        const result = parsed.data.data.agentReadwiseFetch;

        if (result.__typename === "AgentToolError") {
          const statusCode = result.code === "NOT_FOUND" ? 404 : 500;
          throw createAPIError(statusCode, "Backend", result.message);
        }

        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

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
