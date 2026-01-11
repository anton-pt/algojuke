/**
 * Readwise Auth Service
 *
 * Manages Readwise API tokens stored in Clerk private metadata.
 * Readwise uses simple token auth (not OAuth), tokens are long-lived until manually revoked.
 */

import { clerkClient } from "@clerk/express";
import axios from "axios";
import {
  ReadwiseTokens,
  ReadwiseTokensSchema,
  ReadwiseErrorCode,
} from "../schemas/auth.js";
import { logger } from "../utils/logger.js";

const READWISE_AUTH_URL = "https://readwise.io/api/v2/auth/";
const VALIDATION_TIMEOUT_MS = 10000;

/**
 * Get Readwise tokens for a user from Clerk private metadata
 *
 * @param userId - Clerk user ID
 * @returns Readwise tokens if connected, null otherwise
 */
export async function getReadwiseTokens(
  userId: string,
): Promise<ReadwiseTokens | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const readwiseData = user.privateMetadata?.readwise;

    if (!readwiseData) {
      return null;
    }

    // Validate the stored data matches our schema
    const parsed = ReadwiseTokensSchema.safeParse(readwiseData);
    if (!parsed.success) {
      logger.warn("readwise_tokens_invalid", {
        userId,
        errors: parsed.error.issues,
      });
      return null;
    }

    return parsed.data;
  } catch (error) {
    logger.error("get_readwise_tokens_failed", {
      userId,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Store Readwise tokens for a user in Clerk private metadata
 *
 * @param userId - Clerk user ID
 * @param accessToken - Readwise API access token
 * @returns Connection timestamp
 */
export async function storeReadwiseTokens(
  userId: string,
  accessToken: string,
): Promise<number> {
  const startTime = Date.now();
  const connectedAt = Date.now();

  try {
    const readwiseTokens: ReadwiseTokens = {
      accessToken,
      connectedAt,
    };

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        readwise: readwiseTokens,
      },
    });

    const duration = Date.now() - startTime;
    logger.info("readwise_tokens_stored", {
      userId,
      connectedAt,
      duration,
    });

    return connectedAt;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("store_readwise_tokens_failed", {
      userId,
      duration,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Check if a user has a Readwise connection
 *
 * @param userId - Clerk user ID
 * @returns true if user has valid Readwise tokens
 */
export async function hasReadwiseConnection(userId: string): Promise<boolean> {
  const tokens = await getReadwiseTokens(userId);
  return tokens !== null;
}

/**
 * Clear Readwise tokens for a user (disconnect)
 *
 * @param userId - Clerk user ID
 */
export async function clearReadwiseTokens(userId: string): Promise<void> {
  const startTime = Date.now();

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        readwise: null,
      },
    });

    const duration = Date.now() - startTime;
    logger.info("readwise_tokens_cleared", {
      userId,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("clear_readwise_tokens_failed", {
      userId,
      duration,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Validate a Readwise access token by calling Readwise's auth endpoint
 *
 * @param accessToken - Readwise API access token
 * @returns Validation result with error code if invalid
 */
export async function validateReadwiseToken(accessToken: string): Promise<{
  valid: boolean;
  errorCode?: ReadwiseErrorCode;
}> {
  const startTime = Date.now();

  try {
    const response = await axios.get(READWISE_AUTH_URL, {
      headers: {
        Authorization: `Token ${accessToken}`,
      },
      timeout: VALIDATION_TIMEOUT_MS,
      validateStatus: () => true, // Don't throw on non-2xx
    });

    const duration = Date.now() - startTime;

    if (response.status === 204) {
      logger.info("readwise_token_validation_success", { duration });
      return { valid: true };
    }

    if (response.status === 401) {
      logger.info("readwise_token_validation_revoked", {
        duration,
        status: response.status,
      });
      return { valid: false, errorCode: "TOKEN_REVOKED" };
    }

    logger.warn("readwise_token_validation_invalid", {
      duration,
      status: response.status,
    });
    return { valid: false, errorCode: "INVALID_TOKEN" };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        logger.warn("readwise_token_validation_timeout", { duration });
        return { valid: false, errorCode: "TIMEOUT" };
      }
      logger.warn("readwise_token_validation_network_error", {
        duration,
        error: error.message,
      });
      return { valid: false, errorCode: "NETWORK_ERROR" };
    }

    logger.error("readwise_token_validation_unknown_error", {
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    return { valid: false, errorCode: "UNKNOWN" };
  }
}

/**
 * Get error message for a Readwise error code
 *
 * @param errorCode - Readwise error code
 * @returns User-friendly error message
 */
export function getReadwiseErrorMessage(errorCode: ReadwiseErrorCode): string {
  switch (errorCode) {
    case "INVALID_TOKEN":
      return "Invalid token. Please check your token and try again.";
    case "TOKEN_REVOKED":
      return "Token is invalid or has been revoked. Please generate a new token.";
    case "NETWORK_ERROR":
      return "Unable to verify token. Please try again later.";
    case "TIMEOUT":
      return "Connection timed out. Please try again.";
    case "UNKNOWN":
    default:
      return "Unable to verify token. Please try again later.";
  }
}
