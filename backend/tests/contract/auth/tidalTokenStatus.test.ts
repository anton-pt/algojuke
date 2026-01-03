/**
 * Contract tests for GET /api/auth/tidal/tokens endpoint
 *
 * Tests the Tidal token status response schema.
 */

import { describe, it, expect } from 'vitest';
import { TidalTokenStatusSchema } from '../../../src/schemas/auth.js';

describe('GET /api/auth/tidal/tokens contract', () => {
  describe('TidalTokenStatusSchema', () => {
    it('validates response when no tokens exist', () => {
      const response = {
        hasTokens: false,
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTokens).toBe(false);
        expect(result.data.expiresAt).toBeUndefined();
        expect(result.data.isExpired).toBeUndefined();
        expect(result.data.scopes).toBeUndefined();
      }
    });

    it('validates response when tokens exist and are valid', () => {
      const futureTimestamp = Date.now() + 86400000; // 24 hours from now
      const response = {
        hasTokens: true,
        expiresAt: futureTimestamp,
        isExpired: false,
        scopes: ['collection.read', 'playlists.read'],
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTokens).toBe(true);
        expect(result.data.expiresAt).toBe(futureTimestamp);
        expect(result.data.isExpired).toBe(false);
        expect(result.data.scopes).toEqual(['collection.read', 'playlists.read']);
      }
    });

    it('validates response when tokens exist but are expired', () => {
      const pastTimestamp = Date.now() - 86400000; // 24 hours ago
      const response = {
        hasTokens: true,
        expiresAt: pastTimestamp,
        isExpired: true,
        scopes: ['collection.read'],
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTokens).toBe(true);
        expect(result.data.isExpired).toBe(true);
      }
    });

    it('validates response with hasTokens true but optional fields omitted', () => {
      // Edge case: tokens exist but we only return minimal info
      const response = {
        hasTokens: true,
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('rejects missing hasTokens field', () => {
      const response = {
        expiresAt: Date.now(),
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean hasTokens', () => {
      const response = {
        hasTokens: 'yes',
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('validates response with empty scopes array', () => {
      // This is technically valid per schema, though shouldn't happen in practice
      const response = {
        hasTokens: true,
        expiresAt: Date.now(),
        isExpired: false,
        scopes: [],
      };

      const result = TidalTokenStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
