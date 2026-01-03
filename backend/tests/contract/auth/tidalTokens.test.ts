/**
 * Contract tests for POST /api/auth/tidal/tokens endpoint
 *
 * Tests the Tidal tokens storage request/response schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  TidalTokensInputSchema,
  TidalTokensResponseSchema,
  hasRequiredScopes,
  REQUIRED_TIDAL_SCOPES,
} from '../../../src/schemas/auth.js';

describe('POST /api/auth/tidal/tokens contract', () => {
  describe('TidalTokensInputSchema', () => {
    it('validates valid token input', () => {
      const input = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt: Date.now() + 86400000,
        scopes: ['collection.read', 'playlists.read'],
      };

      const result = TidalTokensInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('validates input with all required scopes', () => {
      const input = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt: Date.now() + 86400000,
        scopes: [...REQUIRED_TIDAL_SCOPES],
      };

      const result = TidalTokensInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects empty access token', () => {
      const input = {
        accessToken: '',
        refreshToken: 'refresh_token_456',
        expiresAt: Date.now() + 86400000,
        scopes: ['collection.read'],
      };

      const result = TidalTokensInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Access token is required');
      }
    });

    it('rejects empty refresh token', () => {
      const input = {
        accessToken: 'access_token_123',
        refreshToken: '',
        expiresAt: Date.now() + 86400000,
        scopes: ['collection.read'],
      };

      const result = TidalTokensInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Refresh token is required');
      }
    });

    it('rejects negative expiresAt', () => {
      const input = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt: -1,
        scopes: ['collection.read'],
      };

      const result = TidalTokensInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects empty scopes array', () => {
      const input = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt: Date.now() + 86400000,
        scopes: [],
      };

      const result = TidalTokensInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('At least one scope is required');
      }
    });
  });

  describe('TidalTokensResponseSchema', () => {
    it('validates successful response', () => {
      const response = {
        success: true,
        connectedAt: Date.now(),
      };

      const result = TidalTokensResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('rejects missing connectedAt', () => {
      const response = {
        success: true,
      };

      const result = TidalTokensResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('rejects negative connectedAt', () => {
      const response = {
        success: true,
        connectedAt: -1,
      };

      const result = TidalTokensResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('hasRequiredScopes', () => {
    it('returns true when all required scopes are present', () => {
      const scopes = [...REQUIRED_TIDAL_SCOPES];
      expect(hasRequiredScopes(scopes)).toBe(true);
    });

    it('returns true when extra scopes are present', () => {
      const scopes = [...REQUIRED_TIDAL_SCOPES, 'extra.scope'];
      expect(hasRequiredScopes(scopes)).toBe(true);
    });

    it('returns false when a required scope is missing', () => {
      const scopes = REQUIRED_TIDAL_SCOPES.slice(0, -1);
      expect(hasRequiredScopes(scopes)).toBe(false);
    });

    it('returns false for empty scopes', () => {
      expect(hasRequiredScopes([])).toBe(false);
    });
  });
});
