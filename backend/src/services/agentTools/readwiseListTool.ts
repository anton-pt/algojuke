/**
 * Readwise List Tool
 *
 * Feature: ALG-82
 *
 * Lists documents from user's Readwise Reader queue with optional filters.
 */

import axios, { AxiosError } from "axios";
import {
  ReadwiseListInputSchema,
  type ReadwiseListInput,
} from "../../schemas/agentTools.js";
import type {
  ReadwiseListOutput,
  ReadwiseDocument,
} from "../../types/agentTools.js";
import { createToolError } from "../../types/agentTools.js";
import { getReadwiseTokens } from "../readwiseAuthService.js";
import { logger } from "../../utils/logger.js";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const READWISE_API_BASE = "https://readwise.io";
const READWISE_LIST_ENDPOINT = "/api/v3/list/";
const REQUEST_TIMEOUT_MS = 15000;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for Readwise list tool execution
 */
export interface ReadwiseListContext {
  userId: string;
}

/**
 * Readwise API response shape for list endpoint
 */
interface ReadwiseApiDocument {
  id: string;
  url: string;
  title: string;
  author: string | null;
  source: string;
  category: string;
  location: string;
  word_count: number | null;
  reading_progress: number;
  published_date: string | null;
  created_at: string;
  tags: Record<string, string> | null;
}

interface ReadwiseApiListResponse {
  count: number;
  nextPageCursor: string | null;
  results: ReadwiseApiDocument[];
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Calculate estimated reading time from word count
 * Assumes average reading speed of 200 words per minute
 */
function calculateReadingTime(wordCount: number | null): number | null {
  if (wordCount === null || wordCount <= 0) return null;
  return Math.ceil(wordCount / 200);
}

/**
 * Transform Readwise API document to our ReadwiseDocument type
 */
function transformDocument(doc: ReadwiseApiDocument): ReadwiseDocument {
  return {
    id: doc.id,
    url: doc.url,
    title: doc.title,
    author: doc.author,
    source: doc.source,
    category: doc.category,
    location: doc.location,
    wordCount: doc.word_count,
    readingTimeMinutes: calculateReadingTime(doc.word_count),
    publishedAt: doc.published_date,
    savedAt: doc.created_at,
    tags: doc.tags ? Object.keys(doc.tags) : [],
  };
}

/**
 * Build summary message based on results
 */
function buildSummary(
  count: number,
  hasMore: boolean,
  filters: { location?: string; category?: string; tags?: string[] },
): string {
  if (count === 0) {
    const filterParts: string[] = [];
    if (filters.location) filterParts.push(`location "${filters.location}"`);
    if (filters.category) filterParts.push(`category "${filters.category}"`);
    if (filters.tags?.length)
      filterParts.push(`tags ${filters.tags.join(", ")}`);

    if (filterParts.length > 0) {
      return `No documents found with ${filterParts.join(" and ")}`;
    }
    return "No documents found in your Readwise queue";
  }

  const suffix = hasMore ? " (more available)" : "";
  return `Found ${count} document${count === 1 ? "" : "s"}${suffix}`;
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute Readwise list tool
 *
 * @param input - Validated Readwise list input
 * @param context - Required context including userId
 * @returns ReadwiseListOutput with documents matching filters
 * @throws ToolError on validation, auth, or API errors
 */
export async function executeReadwiseList(
  input: ReadwiseListInput,
  context: ReadwiseListContext,
): Promise<ReadwiseListOutput> {
  const startTime = Date.now();
  const { userId } = context;

  logger.info("readwise_list_tool_start", {
    location: input.location,
    category: input.category,
    tagsCount: input.tags?.length ?? 0,
    limit: input.limit,
  });

  // Validate input
  const validationResult = ReadwiseListInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(", ");
    throw createToolError(errorMessage, false, false, "VALIDATION_ERROR");
  }

  const { location, category, tags, limit } = validationResult.data;

  // Get user's Readwise token
  let accessToken: string;
  try {
    const tokens = await getReadwiseTokens(userId);
    if (!tokens) {
      throw createToolError(
        "Readwise is not connected. Please connect your Readwise account in settings.",
        false,
        false,
        "NOT_CONNECTED",
      );
    }
    accessToken = tokens.accessToken;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error; // Re-throw ToolErrors
    }
    logger.error("readwise_list_token_fetch_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw createToolError(
      "Failed to retrieve Readwise credentials",
      true,
      false,
      "INTERNAL_ERROR",
    );
  }

  // Build query parameters
  const params = new URLSearchParams();
  if (location) params.append("location", location);
  if (category) params.append("category", category);
  if (tags?.length) {
    // Readwise API accepts multiple tag params
    for (const tag of tags) {
      params.append("tag", tag);
    }
  }
  params.append("pageCursor", ""); // Start from beginning
  // Request one more than limit to detect hasMore
  params.append("pageSize", String(Math.min(limit + 1, 101)));

  try {
    const response = await axios.get<ReadwiseApiListResponse>(
      `${READWISE_API_BASE}${READWISE_LIST_ENDPOINT}`,
      {
        params,
        headers: {
          Authorization: `Token ${accessToken}`,
        },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true, // Don't throw on non-2xx
      },
    );

    const durationMs = Date.now() - startTime;

    // Handle error responses
    if (response.status === 401) {
      logger.warn("readwise_list_unauthorized", { userId, durationMs });
      throw createToolError(
        "Readwise token is invalid or has been revoked. Please reconnect your account.",
        false,
        false,
        "UNAUTHORIZED",
      );
    }

    if (response.status === 429) {
      logger.warn("readwise_list_rate_limited", { userId, durationMs });
      throw createToolError(
        "Readwise rate limit exceeded. Please wait a moment and try again.",
        true,
        false,
        "RATE_LIMIT",
      );
    }

    if (response.status >= 500) {
      logger.warn("readwise_list_server_error", {
        userId,
        status: response.status,
        durationMs,
      });
      throw createToolError(
        "Readwise is temporarily unavailable. Please try again later.",
        true,
        false,
        "INTERNAL_ERROR",
      );
    }

    if (response.status !== 200) {
      logger.error("readwise_list_unexpected_status", {
        userId,
        status: response.status,
        durationMs,
      });
      throw createToolError(
        "Unexpected error from Readwise API",
        true,
        false,
        "INTERNAL_ERROR",
      );
    }

    const data = response.data;

    // Determine if there are more results
    const hasMore = data.results.length > limit || data.nextPageCursor !== null;

    // Limit results to requested amount
    const limitedResults = data.results.slice(0, limit);

    // Transform documents
    const documents = limitedResults.map(transformDocument);

    const filters = {
      location,
      category,
      tags,
    };

    const summary = buildSummary(documents.length, hasMore, filters);

    logger.info("readwise_list_tool_complete", {
      documentsFound: documents.length,
      totalCount: data.count,
      hasMore,
      durationMs,
    });

    return {
      documents,
      filters,
      totalFound: data.count,
      hasMore,
      summary,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Re-throw ToolErrors
    if (error instanceof Error && "retryable" in error) {
      throw error;
    }

    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === "ECONNABORTED") {
        logger.warn("readwise_list_timeout", { userId, durationMs });
        throw createToolError(
          "Readwise request timed out. Please try again.",
          true,
          false,
          "TIMEOUT",
        );
      }

      if (
        axiosError.code === "ENOTFOUND" ||
        axiosError.code === "ECONNREFUSED"
      ) {
        logger.warn("readwise_list_network_error", {
          userId,
          code: axiosError.code,
          durationMs,
        });
        throw createToolError(
          "Unable to connect to Readwise. Please check your connection.",
          true,
          false,
          "NETWORK_ERROR",
        );
      }
    }

    logger.error("readwise_list_unexpected_error", {
      userId,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });

    throw createToolError(
      "An unexpected error occurred while fetching documents",
      true,
      false,
      "INTERNAL_ERROR",
    );
  }
}
