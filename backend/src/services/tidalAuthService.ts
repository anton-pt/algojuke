/**
 * Tidal Auth Service
 *
 * Manages Tidal OAuth tokens stored in Clerk private metadata.
 */

import { clerkClient } from '@clerk/express';
import { TidalTokens, TidalTokensSchema, TidalTokensInput } from '../schemas/auth.js';
import { logger } from '../utils/logger.js';

/**
 * Get Tidal tokens for a user from Clerk private metadata
 *
 * @param userId - Clerk user ID
 * @returns Tidal tokens if connected, null otherwise
 */
export async function getTidalTokens(userId: string): Promise<TidalTokens | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const tidalData = user.privateMetadata?.tidal;

    if (!tidalData) {
      return null;
    }

    // Validate the stored data matches our schema
    const parsed = TidalTokensSchema.safeParse(tidalData);
    if (!parsed.success) {
      logger.warn('tidal_tokens_invalid', {
        userId,
        errors: parsed.error.issues,
      });
      return null;
    }

    return parsed.data;
  } catch (error) {
    logger.error('get_tidal_tokens_failed', {
      userId,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Store Tidal tokens for a user in Clerk private metadata
 *
 * @param userId - Clerk user ID
 * @param tokens - Tidal OAuth tokens from frontend
 * @returns Connection timestamp
 */
export async function storeTidalTokens(
  userId: string,
  tokens: TidalTokensInput
): Promise<number> {
  const startTime = Date.now();
  const connectedAt = Date.now();

  try {
    const tidalTokens: TidalTokens = {
      ...tokens,
      connectedAt,
    };

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        tidal: tidalTokens,
      },
    });

    const duration = Date.now() - startTime;
    logger.info('tidal_tokens_stored', {
      userId,
      connectedAt,
      duration,
      scopeCount: tokens.scopes.length,
    });

    return connectedAt;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('store_tidal_tokens_failed', {
      userId,
      duration,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Check if a user has a Tidal connection
 *
 * @param userId - Clerk user ID
 * @returns true if user has valid Tidal tokens
 */
export async function hasTidalConnection(userId: string): Promise<boolean> {
  const tokens = await getTidalTokens(userId);
  return tokens !== null;
}

/**
 * Check if the user's Tidal access token is expired
 *
 * @param userId - Clerk user ID
 * @returns true if expired, false if valid, null if no tokens
 */
export async function isTokenExpired(userId: string): Promise<boolean | null> {
  const tokens = await getTidalTokens(userId);
  if (!tokens) {
    return null;
  }
  return Date.now() > tokens.expiresAt;
}

/**
 * Refresh Tidal tokens for a user
 *
 * Updates the stored tokens after the frontend has refreshed them via the Tidal SDK.
 * Logs success/failure with duration for observability (SC-004).
 *
 * @param userId - Clerk user ID
 * @param tokens - Refreshed Tidal OAuth tokens from frontend
 * @returns Updated token status
 */
export async function refreshTidalTokens(
  userId: string,
  tokens: TidalTokensInput
): Promise<{ success: boolean; expiresAt: number }> {
  const startTime = Date.now();

  try {
    // Get existing tokens to preserve connectedAt
    const existingTokens = await getTidalTokens(userId);
    const connectedAt = existingTokens?.connectedAt ?? Date.now();

    const tidalTokens: TidalTokens = {
      ...tokens,
      connectedAt,
    };

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        tidal: tidalTokens,
      },
    });

    const duration = Date.now() - startTime;
    logger.info('tidal_tokens_refreshed', {
      userId,
      duration,
      expiresAt: tokens.expiresAt,
      scopeCount: tokens.scopes.length,
      previousExpiresAt: existingTokens?.expiresAt,
    });

    return {
      success: true,
      expiresAt: tokens.expiresAt,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('tidal_token_refresh_failed', {
      userId,
      duration,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Clear Tidal tokens for a user (disconnect)
 * Note: This is not exposed via API in the current feature scope
 *
 * @param userId - Clerk user ID
 */
export async function clearTidalTokens(userId: string): Promise<void> {
  const startTime = Date.now();

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        tidal: null,
      },
    });

    const duration = Date.now() - startTime;
    logger.info('tidal_tokens_cleared', {
      userId,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('clear_tidal_tokens_failed', {
      userId,
      duration,
      error: String(error),
    });
    throw error;
  }
}
