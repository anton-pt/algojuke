/**
 * Tidal Auth Service
 *
 * Manages Tidal OAuth tokens stored in Clerk private metadata.
 */

import { clerkClient } from '@clerk/express';
import axios from 'axios';
import { TidalTokens, TidalTokensSchema, TidalTokensInput } from '../schemas/auth.js';
import { logger } from '../utils/logger.js';

const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';

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
 * Attempt to refresh Tidal tokens server-side using the refresh token
 *
 * This function calls Tidal's OAuth token endpoint with the stored refresh token.
 * If successful, it updates the tokens in Clerk metadata and returns the new access token.
 *
 * @param userId - Clerk user ID
 * @returns The refreshed access token, or null if refresh failed
 */
export async function attemptTokenRefresh(userId: string): Promise<string | null> {
  const startTime = Date.now();

  try {
    const existingTokens = await getTidalTokens(userId);
    if (!existingTokens) {
      logger.warn('token_refresh_no_tokens', { userId });
      return null;
    }

    const clientId = process.env.TIDAL_CLIENT_ID;
    const clientSecret = process.env.TIDAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('token_refresh_missing_credentials', { userId });
      return null;
    }

    // Call Tidal's token endpoint with refresh_token grant
    const response = await axios.post(
      TIDAL_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: existingTokens.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Calculate new expiration (expires_in is in seconds)
    const expiresAt = Date.now() + (expires_in * 1000);

    // Update tokens in Clerk metadata
    const updatedTokens: TidalTokens = {
      accessToken: access_token,
      refreshToken: refresh_token || existingTokens.refreshToken, // Some OAuth flows don't return new refresh token
      expiresAt,
      scopes: existingTokens.scopes,
      connectedAt: existingTokens.connectedAt,
    };

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        tidal: updatedTokens,
      },
    });

    const duration = Date.now() - startTime;
    logger.info('token_refresh_success', {
      userId,
      duration,
      expiresAt,
      previousExpiresAt: existingTokens.expiresAt,
    });

    return access_token;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      logger.error('token_refresh_api_failed', {
        userId,
        duration,
        status: error.response?.status,
        error: error.response?.data || error.message,
      });
    } else {
      logger.error('token_refresh_failed', {
        userId,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }
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
