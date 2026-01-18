/**
 * Readwise Fetch Tool
 *
 * Feature: ALG-82
 *
 * Fetches document content from Readwise Reader and processes it
 * using Claude for extraction or summarization.
 */

import axios, { AxiosError } from "axios";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  ReadwiseFetchInputSchema,
  type ReadwiseFetchInput,
} from "../../schemas/agentTools.js";
import type {
  ReadwiseFetchOutput,
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
const CLAUDE_MODEL = "claude-haiku-4-5";
const CLAUDE_MAX_TOKENS = 2048;

// Summary length word targets
const SUMMARY_LENGTHS = {
  short: 100,
  medium: 250,
  long: 500,
} as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for Readwise fetch tool execution
 */
export interface ReadwiseFetchContext {
  userId: string;
}

/**
 * Readwise API response shape for list endpoint (single document)
 * Note: tags is an object where keys are tag names, not an array
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
  tags: Record<string, unknown> | null;
  html_content?: string;
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
 */
function calculateReadingTime(wordCount: number | null): number | null {
  if (wordCount === null || wordCount <= 0) return null;
  return Math.ceil(wordCount / 200);
}

/**
 * Transform Readwise API document to our ReadwiseDocument type
 */
function transformDocument(doc: ReadwiseApiDocument): ReadwiseDocument {
  // Tags come as an object with tag names as keys, extract the keys
  const tags =
    doc.tags && typeof doc.tags === "object" ? Object.keys(doc.tags) : [];

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
    tags,
  };
}

/**
 * Extract clean content from HTML using Claude
 */
async function extractContent(
  htmlContent: string,
  title: string,
): Promise<string> {
  const prompt = `Extract the main content from this HTML article titled "${title}".

Instructions:
- Preserve paragraph breaks as double newlines
- Use *asterisks* around text that should be emphasized when spoken aloud (important points, key terms)
- Remove navigation, ads, sidebars, and other non-content elements
- Remove any HTML tags but keep the text structure
- Keep section headings if present (prefix with ##)
- Do not add any commentary or explanation, just output the cleaned content

HTML Content:
${htmlContent}`;

  try {
    const result = await generateText({
      model: anthropic(CLAUDE_MODEL),
      prompt,
      maxOutputTokens: CLAUDE_MAX_TOKENS,
    });

    return result.text.trim();
  } catch (error) {
    logger.error("readwise_fetch_extraction_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw createToolError(
      "Failed to extract content from document",
      true,
      false,
      "EXTRACTION_ERROR",
    );
  }
}

/**
 * Summarize content using Claude
 */
async function summarizeContent(
  content: string,
  title: string,
  length: "short" | "medium" | "long",
): Promise<string> {
  const wordTarget = SUMMARY_LENGTHS[length];

  const prompt = `Summarize this article titled "${title}" in approximately ${wordTarget} words.

Instructions:
- Write in a conversational style suitable for spoken audio
- Use *asterisks* around text that should be emphasized when spoken aloud
- Focus on the main points and key takeaways
- Do not include phrases like "This article discusses..." - just dive into the content
- Make it engaging and informative

Content:
${content}`;

  try {
    const result = await generateText({
      model: anthropic(CLAUDE_MODEL),
      prompt,
      maxOutputTokens: CLAUDE_MAX_TOKENS,
    });

    return result.text.trim();
  } catch (error) {
    logger.error("readwise_fetch_summarization_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw createToolError(
      "Failed to summarize document content",
      true,
      false,
      "EXTRACTION_ERROR",
    );
  }
}

/**
 * Build summary message based on content mode
 */
function buildSummary(
  title: string,
  contentMode: "summary" | "full",
  summaryLength?: "short" | "medium" | "long",
): string {
  if (contentMode === "summary") {
    return `Generated ${summaryLength} summary of "${title}"`;
  }
  return `Extracted full content from "${title}"`;
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute Readwise fetch tool
 *
 * @param input - Validated Readwise fetch input
 * @param context - Required context including userId
 * @returns ReadwiseFetchOutput with document content
 * @throws ToolError on validation, auth, or API errors
 */
export async function executeReadwiseFetch(
  input: ReadwiseFetchInput,
  context: ReadwiseFetchContext,
): Promise<ReadwiseFetchOutput> {
  const startTime = Date.now();
  const { userId } = context;

  logger.info("readwise_fetch_tool_start", {
    documentId: input.documentId,
    contentMode: input.contentMode,
    summaryLength: input.summaryLength,
  });

  // Validate input
  const validationResult = ReadwiseFetchInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(", ");
    throw createToolError(errorMessage, false, false, "VALIDATION_ERROR");
  }

  const { documentId, contentMode, summaryLength } = validationResult.data;

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
    logger.error("readwise_fetch_token_fetch_failed", {
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

  // Fetch document with HTML content
  const params = new URLSearchParams();
  params.append("id", documentId);
  params.append("withHtmlContent", "true");

  try {
    const response = await axios.get<ReadwiseApiListResponse>(
      `${READWISE_API_BASE}${READWISE_LIST_ENDPOINT}`,
      {
        params,
        headers: {
          Authorization: `Token ${accessToken}`,
        },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      },
    );

    // Handle error responses
    if (response.status === 401) {
      const durationMs = Date.now() - startTime;
      logger.warn("readwise_fetch_unauthorized", { userId, durationMs });
      throw createToolError(
        "Readwise token is invalid or has been revoked. Please reconnect your account.",
        false,
        false,
        "UNAUTHORIZED",
      );
    }

    if (response.status === 429) {
      const durationMs = Date.now() - startTime;
      logger.warn("readwise_fetch_rate_limited", { userId, durationMs });
      throw createToolError(
        "Readwise rate limit exceeded. Please wait a moment and try again.",
        true,
        false,
        "RATE_LIMIT",
      );
    }

    if (response.status >= 500) {
      const durationMs = Date.now() - startTime;
      logger.warn("readwise_fetch_server_error", {
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
      const durationMs = Date.now() - startTime;
      logger.error("readwise_fetch_unexpected_status", {
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

    // Check if document was found
    if (data.results.length === 0) {
      const durationMs = Date.now() - startTime;
      logger.warn("readwise_fetch_not_found", {
        userId,
        documentId,
        durationMs,
      });
      throw createToolError(
        `Document with ID "${documentId}" was not found`,
        false,
        false,
        "NOT_FOUND",
      );
    }

    const apiDoc = data.results[0];
    const document = transformDocument(apiDoc);

    // Check if HTML content is available
    if (!apiDoc.html_content) {
      const durationMs = Date.now() - startTime;
      logger.warn("readwise_fetch_no_content", {
        userId,
        documentId,
        durationMs,
      });
      throw createToolError(
        "Document content is not available. The document may still be processing.",
        true,
        false,
        "CONTENT_UNAVAILABLE",
      );
    }

    // Process content based on mode
    let content: string;

    if (contentMode === "full") {
      content = await extractContent(apiDoc.html_content, document.title);
    } else {
      // First extract, then summarize
      const extractedContent = await extractContent(
        apiDoc.html_content,
        document.title,
      );
      content = await summarizeContent(
        extractedContent,
        document.title,
        summaryLength,
      );
    }

    const durationMs = Date.now() - startTime;
    const summary = buildSummary(document.title, contentMode, summaryLength);

    logger.info("readwise_fetch_tool_complete", {
      documentId,
      contentMode,
      summaryLength,
      contentLength: content.length,
      durationMs,
    });

    return {
      document,
      content,
      contentMode,
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
        logger.warn("readwise_fetch_timeout", { userId, durationMs });
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
        logger.warn("readwise_fetch_network_error", {
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

    logger.error("readwise_fetch_unexpected_error", {
      userId,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });

    throw createToolError(
      "An unexpected error occurred while fetching document content",
      true,
      false,
      "INTERNAL_ERROR",
    );
  }
}
