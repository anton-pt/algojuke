/**
 * Settings Resolver
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 *
 * GraphQL resolver for settings operations including
 * Tidal and Readwise connection status.
 */

import {
  getReadwiseTokens,
  storeReadwiseTokens,
  clearReadwiseTokens,
  validateReadwiseToken,
  getReadwiseErrorMessage,
} from "../services/readwiseAuthService.js";
import { getTidalTokens } from "../services/tidalAuthService.js";
import { ReadwiseErrorCode } from "../schemas/auth.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolverContext {
  userId?: string;
}

// Result union member types
interface TidalConnectionStatus {
  isConnected: boolean;
  connectedAt: string | null;
}

interface ReadwiseConnectionStatus {
  isConnected: boolean;
  connectedAt: string | null;
}

interface ReadwiseConnectionSuccess {
  __typename: "ReadwiseConnectionSuccess";
  connectedAt: string;
}

interface ReadwiseValidationError {
  __typename: "ReadwiseValidationError";
  message: string;
  code: ReadwiseErrorCode;
}

interface ReadwiseDisconnectSuccess {
  __typename: "ReadwiseDisconnectSuccess";
  success: boolean;
}

type ConnectReadwiseResult =
  | ReadwiseConnectionSuccess
  | ReadwiseValidationError;
type DisconnectReadwiseResult =
  | ReadwiseDisconnectSuccess
  | ReadwiseValidationError;

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const settingsResolvers = {
  Query: {
    tidalConnectionStatus: async (
      _parent: unknown,
      _args: unknown,
      context: ResolverContext,
    ): Promise<TidalConnectionStatus> => {
      const userId = context.userId;

      if (!userId) {
        return {
          isConnected: false,
          connectedAt: null,
        };
      }

      try {
        const tokens = await getTidalTokens(userId);
        return {
          isConnected: tokens !== null,
          connectedAt: tokens?.connectedAt
            ? new Date(tokens.connectedAt).toISOString()
            : null,
        };
      } catch (error) {
        logger.error("tidal_connection_status_error", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          isConnected: false,
          connectedAt: null,
        };
      }
    },

    readwiseConnectionStatus: async (
      _parent: unknown,
      _args: unknown,
      context: ResolverContext,
    ): Promise<ReadwiseConnectionStatus> => {
      const userId = context.userId;

      if (!userId) {
        return {
          isConnected: false,
          connectedAt: null,
        };
      }

      try {
        const tokens = await getReadwiseTokens(userId);
        return {
          isConnected: tokens !== null,
          connectedAt: tokens?.connectedAt
            ? new Date(tokens.connectedAt).toISOString()
            : null,
        };
      } catch (error) {
        logger.error("readwise_connection_status_error", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          isConnected: false,
          connectedAt: null,
        };
      }
    },
  },

  Mutation: {
    connectReadwise: async (
      _parent: unknown,
      args: { accessToken: string },
      context: ResolverContext,
    ): Promise<ConnectReadwiseResult> => {
      const startTime = Date.now();
      const userId = context.userId;

      if (!userId) {
        return {
          __typename: "ReadwiseValidationError",
          message: "Authentication required",
          code: "UNKNOWN",
        };
      }

      // Trim whitespace from token (FR-011)
      const accessToken = args.accessToken.trim();

      // Validate token is not empty (FR-009)
      if (!accessToken) {
        return {
          __typename: "ReadwiseValidationError",
          message: "Token is required",
          code: "INVALID_TOKEN",
        };
      }

      logger.info("readwise_connect_mutation", { userId });

      // Validate token with Readwise API (FR-014)
      const validation = await validateReadwiseToken(accessToken);

      if (!validation.valid) {
        const duration = Date.now() - startTime;
        logger.info("readwise_connect_validation_failed", {
          userId,
          errorCode: validation.errorCode,
          durationMs: duration,
        });

        return {
          __typename: "ReadwiseValidationError",
          message: getReadwiseErrorMessage(validation.errorCode!),
          code: validation.errorCode!,
        };
      }

      // Store token in Clerk metadata (FR-019, FR-020, FR-021)
      try {
        const connectedAt = await storeReadwiseTokens(userId, accessToken);
        const duration = Date.now() - startTime;

        logger.info("readwise_connect_success", {
          userId,
          connectedAt,
          durationMs: duration,
        });

        return {
          __typename: "ReadwiseConnectionSuccess",
          connectedAt: new Date(connectedAt).toISOString(),
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("readwise_connect_store_failed", {
          userId,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          __typename: "ReadwiseValidationError",
          message: "Failed to store connection. Please try again.",
          code: "UNKNOWN",
        };
      }
    },

    disconnectReadwise: async (
      _parent: unknown,
      _args: unknown,
      context: ResolverContext,
    ): Promise<DisconnectReadwiseResult> => {
      const startTime = Date.now();
      const userId = context.userId;

      if (!userId) {
        return {
          __typename: "ReadwiseValidationError",
          message: "Authentication required",
          code: "UNKNOWN",
        };
      }

      logger.info("readwise_disconnect_mutation", { userId });

      try {
        await clearReadwiseTokens(userId);
        const duration = Date.now() - startTime;

        logger.info("readwise_disconnect_success", {
          userId,
          durationMs: duration,
        });

        return {
          __typename: "ReadwiseDisconnectSuccess",
          success: true,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("readwise_disconnect_failed", {
          userId,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          __typename: "ReadwiseValidationError",
          message: "Failed to disconnect. Please try again.",
          code: "UNKNOWN",
        };
      }
    },
  },

  // Union type resolvers
  ConnectReadwiseResult: {
    __resolveType(obj: ConnectReadwiseResult) {
      return obj.__typename;
    },
  },

  DisconnectReadwiseResult: {
    __resolveType(obj: DisconnectReadwiseResult) {
      return obj.__typename;
    },
  },
};
