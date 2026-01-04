/**
 * Contract tests for GraphQL authentication guard
 *
 * Tests the requireAuth function behavior per FR-001 through FR-006.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraphQLError } from 'graphql';
import {
  requireAuth,
  isAuthenticated,
  type GraphQLContext,
  type AuthenticatedContext,
} from '../../../src/middleware/authGuard.js';

// Mock the security logger
vi.mock('../../../src/utils/securityLogger.js', () => ({
  logAuthFailure: vi.fn(),
}));

import { logAuthFailure } from '../../../src/utils/securityLogger.js';

describe('GraphQL Authentication Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requireAuth', () => {
    it('throws UNAUTHENTICATED error when userId is missing', () => {
      const context: GraphQLContext = {};

      expect(() => requireAuth(context)).toThrow(GraphQLError);

      try {
        requireAuth(context);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        const graphqlError = error as GraphQLError;
        expect(graphqlError.message).toBe('Authentication required');
        expect(graphqlError.extensions?.code).toBe('UNAUTHENTICATED');
      }
    });

    it('throws UNAUTHENTICATED error when userId is undefined', () => {
      const context: GraphQLContext = { userId: undefined };

      expect(() => requireAuth(context)).toThrow(GraphQLError);
    });

    it('logs authentication failure when userId is missing', () => {
      const context: GraphQLContext = {};

      try {
        requireAuth(context, 'getLibraryAlbums');
      } catch {
        // Expected to throw
      }

      expect(logAuthFailure).toHaveBeenCalledWith('getLibraryAlbums');
    });

    it('logs authentication failure with unknown_operation when no operation name provided', () => {
      const context: GraphQLContext = {};

      try {
        requireAuth(context);
      } catch {
        // Expected to throw
      }

      expect(logAuthFailure).toHaveBeenCalledWith('unknown_operation');
    });

    it('does not throw when userId is present', () => {
      const context: GraphQLContext = { userId: 'user_abc123' };

      expect(() => requireAuth(context)).not.toThrow();
    });

    it('narrows type to AuthenticatedContext after passing', () => {
      const context: GraphQLContext = { userId: 'user_abc123', otherProp: 'value' };

      requireAuth(context);

      // After requireAuth, TypeScript should know userId is string
      const authenticatedContext: AuthenticatedContext = context;
      expect(authenticatedContext.userId).toBe('user_abc123');
      expect(authenticatedContext.otherProp).toBe('value');
    });

    it('does not log auth failure when authenticated', () => {
      const context: GraphQLContext = { userId: 'user_abc123' };

      requireAuth(context);

      expect(logAuthFailure).not.toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when userId is missing', () => {
      const context: GraphQLContext = {};

      expect(isAuthenticated(context)).toBe(false);
    });

    it('returns false when userId is undefined', () => {
      const context: GraphQLContext = { userId: undefined };

      expect(isAuthenticated(context)).toBe(false);
    });

    it('returns false when userId is empty string', () => {
      const context: GraphQLContext = { userId: '' };

      expect(isAuthenticated(context)).toBe(false);
    });

    it('returns true when userId is present', () => {
      const context: GraphQLContext = { userId: 'user_abc123' };

      expect(isAuthenticated(context)).toBe(true);
    });

    it('returns true for various valid userId formats', () => {
      const userIds = [
        'user_2abc123',
        '00000000-0000-0000-0000-000000000001',
        'clerk_user_id',
        'u123',
      ];

      for (const userId of userIds) {
        const context: GraphQLContext = { userId };
        expect(isAuthenticated(context)).toBe(true);
      }
    });
  });

  describe('GraphQL resolver integration patterns', () => {
    it('demonstrates typical resolver authentication pattern', async () => {
      const mockLibraryService = {
        getLibraryAlbums: vi.fn().mockResolvedValue([]),
      };

      const resolver = async (
        _parent: unknown,
        _args: unknown,
        context: GraphQLContext & { libraryService: typeof mockLibraryService }
      ) => {
        requireAuth(context, 'getLibraryAlbums');
        return context.libraryService.getLibraryAlbums(context.userId);
      };

      // Authenticated request
      const authenticatedContext: GraphQLContext & { libraryService: typeof mockLibraryService } = {
        userId: 'user_abc123',
        libraryService: mockLibraryService,
      };

      await resolver(null, {}, authenticatedContext);
      expect(mockLibraryService.getLibraryAlbums).toHaveBeenCalledWith('user_abc123');

      // Unauthenticated request
      const unauthenticatedContext: GraphQLContext & { libraryService: typeof mockLibraryService } = {
        userId: undefined,
        libraryService: mockLibraryService,
      };

      await expect(resolver(null, {}, unauthenticatedContext)).rejects.toThrow(GraphQLError);
    });

    it('demonstrates error response format matches spec', () => {
      const context: GraphQLContext = {};

      try {
        requireAuth(context);
      } catch (error) {
        const graphqlError = error as GraphQLError;

        // This matches the expected response format in contracts/graphql-schema-changes.md
        const errorResponse = {
          errors: [
            {
              message: graphqlError.message,
              extensions: graphqlError.extensions,
            },
          ],
          data: null,
        };

        expect(errorResponse).toEqual({
          errors: [
            {
              message: 'Authentication required',
              extensions: { code: 'UNAUTHENTICATED' },
            },
          ],
          data: null,
        });
      }
    });
  });
});
