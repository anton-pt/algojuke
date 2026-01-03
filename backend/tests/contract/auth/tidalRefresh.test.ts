/**
 * Contract tests for POST /api/auth/tidal/refresh endpoint
 *
 * Tests the Tidal token refresh endpoint response schema.
 */

import { describe, it, expect } from 'vitest';
import {
  TidalTokenStatusSchema,
  ErrorResponseSchema,
} from '../../../src/schemas/auth.js';

describe('POST /api/auth/tidal/refresh contract', () => {
  describe('Successful refresh response', () => {
    it('validates token status response after refresh', () => {
      const response = {
        hasTokens: true,
        expiresAt: Date.now() + 86400000, // 24 hours from now
        isExpired: false,
        scopes: [
          'collection.read',
          'playlists.read',
          'playlists.write',
          'recommendations.read',
          'search.read',
          'user.read',
        ],
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTokens).toBe(true);
        expect(result.data.isExpired).toBe(false);
        expect(result.data.scopes?.length).toBe(6);
      }
    });
  });

  describe('Error responses', () => {
    it('validates 401 unauthorized response', () => {
      const response = {
        error: 'unauthorized',
        message: 'Authentication required',
      };

      const result = ErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('validates 403 forbidden response for non-approved user', () => {
      const response = {
        error: 'forbidden',
        message: 'User not approved for beta access',
      };

      const result = ErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('validates 422 no connection response', () => {
      const response = {
        error: 'no_connection',
        message: 'No Tidal connection found',
      };

      const result = ErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('validates 500 internal error response', () => {
      const response = {
        error: 'internal_error',
        message: 'Failed to refresh Tidal tokens',
      };

      const result = ErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
