/**
 * GraphQL Authentication Guard
 *
 * Provides authentication enforcement for GraphQL resolvers.
 * Per FR-006: Validates user identity from Clerk tokens before processing any request.
 */

import { GraphQLError } from 'graphql';
import { logAuthFailure } from '../utils/securityLogger.js';

/**
 * Context interface for authenticated GraphQL operations
 */
export interface AuthenticatedContext {
  userId: string;
  // Additional context properties can be added here
  [key: string]: unknown;
}

/**
 * GraphQL context with optional userId (before authentication check)
 */
export interface GraphQLContext {
  userId?: string;
  [key: string]: unknown;
}

/**
 * Type guard that asserts the context has an authenticated userId
 *
 * @param context - GraphQL context object
 * @param operationName - Name of the operation for logging (optional)
 * @throws GraphQLError with UNAUTHENTICATED code if not authenticated
 *
 * @example
 * ```typescript
 * const resolvers = {
 *   Query: {
 *     getLibraryAlbums: async (_: any, __: any, context: GraphQLContext) => {
 *       requireAuth(context, 'getLibraryAlbums');
 *       // context.userId is now guaranteed to be a string
 *       return libraryService.getLibraryAlbums(context.userId);
 *     },
 *   },
 * };
 * ```
 */
export function requireAuth(
  context: GraphQLContext,
  operationName?: string
): asserts context is AuthenticatedContext {
  if (!context.userId) {
    // Log the authentication failure per FR-026
    logAuthFailure(operationName || 'unknown_operation');

    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

/**
 * Helper function to check if context is authenticated without throwing
 *
 * @param context - GraphQL context object
 * @returns true if userId exists in context
 */
export function isAuthenticated(context: GraphQLContext): context is AuthenticatedContext {
  return typeof context.userId === 'string' && context.userId.length > 0;
}
