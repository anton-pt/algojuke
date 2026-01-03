/**
 * Contract tests for GET /api/auth/status endpoint
 *
 * Tests the authentication status endpoint response schema.
 */

import { describe, it, expect } from 'vitest';
import { AuthStatusSchema } from '../../../src/schemas/auth.js';

describe('GET /api/auth/status contract', () => {
  describe('AuthStatusSchema', () => {
    it('validates unauthenticated response', () => {
      const response = {
        isAuthenticated: false,
        isApproved: false,
        hasTidalConnection: false,
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(false);
        expect(result.data.isApproved).toBe(false);
        expect(result.data.hasTidalConnection).toBe(false);
        expect(result.data.email).toBeUndefined();
        expect(result.data.userId).toBeUndefined();
      }
    });

    it('validates authenticated but not approved response', () => {
      const response = {
        isAuthenticated: true,
        isApproved: false,
        hasTidalConnection: false,
        email: 'random@example.com',
        userId: 'user_123',
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.isApproved).toBe(false);
        expect(result.data.email).toBe('random@example.com');
      }
    });

    it('validates approved user without Tidal response', () => {
      const response = {
        isAuthenticated: true,
        isApproved: true,
        hasTidalConnection: false,
        email: 'anton.tcholakov@gmail.com',
        userId: 'user_456',
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isApproved).toBe(true);
        expect(result.data.hasTidalConnection).toBe(false);
      }
    });

    it('validates fully connected user response', () => {
      const response = {
        isAuthenticated: true,
        isApproved: true,
        hasTidalConnection: true,
        email: 'anton.tcholakov@gmail.com',
        userId: 'user_456',
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.isApproved).toBe(true);
        expect(result.data.hasTidalConnection).toBe(true);
      }
    });

    it('rejects missing required fields', () => {
      const response = {
        isAuthenticated: true,
        // missing isApproved and hasTidalConnection
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const response = {
        isAuthenticated: true,
        isApproved: true,
        hasTidalConnection: true,
        email: 'not-an-email',
        userId: 'user_456',
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });
});
