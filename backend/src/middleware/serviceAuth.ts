/**
 * Service Authentication Middleware
 *
 * Feature: ALG-77 - Cross-service agent tool invocation
 *
 * Provides service-to-service authentication via API key header.
 * Supports dual auth modes:
 * - Service auth: X-API-Key header + userId in input
 * - User auth: Clerk JWT token (userId from context)
 */

import { GraphQLError } from "graphql";
import { logAuthFailure } from "../utils/securityLogger.js";
import { logger } from "../utils/logger.js";

const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

/**
 * Check if request is authenticated via service API key
 *
 * @param apiKey - Value of X-API-Key header
 * @returns true if API key matches SERVICE_API_KEY env var
 */
export function isServiceAuthenticated(apiKey: string | undefined): boolean {
  if (!SERVICE_API_KEY) {
    logger.warn("service_auth_not_configured", {
      message: "SERVICE_API_KEY environment variable not set",
    });
    return false;
  }

  if (!apiKey) {
    return false;
  }

  return apiKey === SERVICE_API_KEY;
}

/**
 * Context interface for service auth resolution
 */
export interface ServiceAuthContext {
  userId?: string;
  serviceApiKey?: string;
}

/**
 * Resolve the effective userId for an agent tool query
 *
 * Handles two authentication modes:
 * 1. Service auth: Valid API key + userId in input → returns input userId
 * 2. User auth: Clerk token (userId in context) → returns context userId
 *
 * User auth takes precedence - if context.userId exists, it is used
 * regardless of API key or input userId.
 *
 * @param context - GraphQL context with optional userId and serviceApiKey
 * @param inputUserId - Optional userId from GraphQL input (for service auth)
 * @param operationName - Name of the operation for logging
 * @returns Resolved userId
 * @throws GraphQLError with UNAUTHENTICATED code if not authenticated
 */
export function resolveAgentToolUserId(
  context: ServiceAuthContext,
  inputUserId: string | undefined | null,
  operationName: string,
): string {
  // User auth takes precedence (Clerk token)
  if (context.userId) {
    logger.debug("agent_tool_user_auth", {
      operation: operationName,
      userId: context.userId,
      authMode: "clerk",
    });
    return context.userId;
  }

  // Check service auth
  const isService = isServiceAuthenticated(context.serviceApiKey);

  if (isService) {
    // Service auth requires userId in input
    if (!inputUserId) {
      logAuthFailure(operationName, "service");
      throw new GraphQLError(
        "userId is required in input for service authentication",
        { extensions: { code: "UNAUTHENTICATED" } },
      );
    }

    logger.debug("agent_tool_service_auth", {
      operation: operationName,
      userId: inputUserId,
      authMode: "api_key",
    });
    return inputUserId;
  }

  // No valid authentication
  logAuthFailure(operationName, "none");
  throw new GraphQLError("Authentication required", {
    extensions: { code: "UNAUTHENTICATED" },
  });
}
