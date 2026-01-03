/**
 * Contract tests for 403 response on non-approved user POST /api/auth/tidal/tokens
 *
 * Tests that non-approved users receive a 403 Forbidden response.
 */

import { describe, it, expect } from 'vitest';
import { ErrorResponseSchema } from '../../../src/schemas/auth.js';
import { isApprovedUser } from '../../../src/config/allowlist.js';

describe('POST /api/auth/tidal/tokens - Non-Approved User', () => {
  describe('403 Forbidden Response', () => {
    it('validates 403 error response schema', () => {
      const errorResponse = {
        error: 'forbidden',
        message: 'User not approved for beta access',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe('forbidden');
        expect(result.data.message).toContain('not approved');
      }
    });

    it('rejects non-approved emails', () => {
      expect(isApprovedUser('random@example.com')).toBe(false);
      expect(isApprovedUser('another.user@gmail.com')).toBe(false);
      expect(isApprovedUser('admin@algojuke.com')).toBe(false);
    });

    it('only approves allowlisted emails', () => {
      // Only anton.tcholakov@gmail.com should be approved
      expect(isApprovedUser('anton.tcholakov@gmail.com')).toBe(true);

      // Similar but different emails should fail
      expect(isApprovedUser('anton.tcholakov@yahoo.com')).toBe(false);
      expect(isApprovedUser('antontcholakov@gmail.com')).toBe(false);
    });
  });

  describe('Error Response Structure', () => {
    it('validates complete error response', () => {
      const errorResponse = {
        error: 'forbidden',
        message: 'User not approved for beta access',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('rejects missing error field', () => {
      const errorResponse = {
        message: 'User not approved for beta access',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(false);
    });

    it('rejects missing message field', () => {
      const errorResponse = {
        error: 'forbidden',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(false);
    });
  });
});
