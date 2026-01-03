/**
 * Integration tests for approved user auth flow
 *
 * Tests the complete authentication flow for approved users.
 * Note: These tests mock Clerk and focus on the integration between components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isApprovedUser } from '../../../src/config/allowlist.js';
import {
  TidalTokensInputSchema,
  AuthStatusSchema,
  TidalTokensSchema,
} from '../../../src/schemas/auth.js';

// Mock Clerk client for integration tests
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => vi.fn((req, res, next) => next()),
  getAuth: vi.fn(() => ({ userId: 'test_user_123' })),
  clerkClient: {
    users: {
      getUser: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
  },
}));

describe('Approved User Auth Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Allowlist verification', () => {
    it('approves anton.tcholakov@gmail.com', () => {
      expect(isApprovedUser('anton.tcholakov@gmail.com')).toBe(true);
    });

    it('approves email case-insensitively', () => {
      expect(isApprovedUser('Anton.Tcholakov@Gmail.com')).toBe(true);
      expect(isApprovedUser('ANTON.TCHOLAKOV@GMAIL.COM')).toBe(true);
    });

    it('rejects non-approved emails', () => {
      expect(isApprovedUser('random@example.com')).toBe(false);
      expect(isApprovedUser('notanton@gmail.com')).toBe(false);
    });
  });

  describe('Token storage flow', () => {
    it('validates and stores tokens correctly', () => {
      // Simulate token input from frontend
      const frontendTokens = {
        accessToken: 'tidal_access_token_xyz',
        refreshToken: 'tidal_refresh_token_abc',
        expiresAt: Date.now() + 86400000,
        scopes: [
          'collection.read',
          'playlists.read',
          'playlists.write',
          'recommendations.read',
          'search.read',
          'user.read',
        ],
      };

      // Validate input
      const inputResult = TidalTokensInputSchema.safeParse(frontendTokens);
      expect(inputResult.success).toBe(true);

      // Create stored tokens (with connectedAt)
      const storedTokens = {
        ...frontendTokens,
        connectedAt: Date.now(),
      };

      // Validate stored format
      const storageResult = TidalTokensSchema.safeParse(storedTokens);
      expect(storageResult.success).toBe(true);
    });

    it('produces correct auth status after connection', () => {
      const authStatus = {
        isAuthenticated: true,
        isApproved: true,
        hasTidalConnection: true,
        email: 'anton.tcholakov@gmail.com',
        userId: 'user_123',
      };

      const result = AuthStatusSchema.safeParse(authStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.isApproved).toBe(true);
        expect(result.data.hasTidalConnection).toBe(true);
      }
    });
  });

  describe('User state transitions', () => {
    it('tracks state: Unauthenticated → Authenticated → Approved → Connected', () => {
      // State 1: Unauthenticated
      const unauthenticated = {
        isAuthenticated: false,
        isApproved: false,
        hasTidalConnection: false,
      };
      expect(AuthStatusSchema.parse(unauthenticated).isAuthenticated).toBe(false);

      // State 2: Authenticated but not approved (this user should go to waitlist)
      const authenticatedNotApproved = {
        isAuthenticated: true,
        isApproved: false,
        hasTidalConnection: false,
        email: 'random@example.com',
        userId: 'user_random',
      };
      expect(AuthStatusSchema.parse(authenticatedNotApproved).isApproved).toBe(false);

      // State 3: Approved but no Tidal
      const approvedNoTidal = {
        isAuthenticated: true,
        isApproved: true,
        hasTidalConnection: false,
        email: 'anton.tcholakov@gmail.com',
        userId: 'user_anton',
      };
      const parsed = AuthStatusSchema.parse(approvedNoTidal);
      expect(parsed.isApproved).toBe(true);
      expect(parsed.hasTidalConnection).toBe(false);

      // State 4: Fully connected
      const connected = {
        isAuthenticated: true,
        isApproved: true,
        hasTidalConnection: true,
        email: 'anton.tcholakov@gmail.com',
        userId: 'user_anton',
      };
      const connectedParsed = AuthStatusSchema.parse(connected);
      expect(connectedParsed.isAuthenticated).toBe(true);
      expect(connectedParsed.isApproved).toBe(true);
      expect(connectedParsed.hasTidalConnection).toBe(true);
    });
  });
});
