/**
 * Auth API Schemas
 * Generated for feature 016-clerk-tidal-auth
 *
 * These Zod schemas define the contract between frontend and backend
 * for authentication and Tidal connection endpoints.
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Schema for storing Tidal OAuth tokens
 * POST /api/auth/tidal/tokens
 */
export const TidalTokensInputSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().min(1, 'Refresh token is required'),
  expiresAt: z.number().positive('Expiration must be a positive timestamp'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
});

export type TidalTokensInput = z.infer<typeof TidalTokensInputSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Schema for auth status response
 * GET /api/auth/status
 */
export const AuthStatusSchema = z.object({
  isAuthenticated: z.boolean(),
  isApproved: z.boolean(),
  hasTidalConnection: z.boolean(),
  email: z.string().email().optional(),
  userId: z.string().optional(),
});

export type AuthStatus = z.infer<typeof AuthStatusSchema>;

/**
 * Schema for Tidal tokens storage response
 * POST /api/auth/tidal/tokens
 */
export const TidalTokensResponseSchema = z.object({
  success: z.boolean(),
  connectedAt: z.number().positive(),
});

export type TidalTokensResponse = z.infer<typeof TidalTokensResponseSchema>;

/**
 * Schema for Tidal token status response
 * GET /api/auth/tidal/tokens
 */
export const TidalTokenStatusSchema = z.object({
  hasTokens: z.boolean(),
  expiresAt: z.number().optional(),
  isExpired: z.boolean().optional(),
  scopes: z.array(z.string()).optional(),
});

export type TidalTokenStatus = z.infer<typeof TidalTokenStatusSchema>;

/**
 * Schema for error responses
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Internal Schemas (Backend Only)
// ============================================================================

/**
 * Schema for Tidal tokens stored in Clerk private metadata
 * This is the complete token object including connectedAt
 */
export const TidalTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().positive(),
  scopes: z.array(z.string()).min(1),
  connectedAt: z.number().positive(),
});

export type TidalTokens = z.infer<typeof TidalTokensSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Required Tidal OAuth scopes
 */
export const REQUIRED_TIDAL_SCOPES = [
  'collection.read',
  'playlists.read',
  'playlists.write',
  'recommendations.read',
  'search.read',
  'user.read',
] as const;

export type TidalScope = (typeof REQUIRED_TIDAL_SCOPES)[number];

/**
 * Validate that all required scopes are present
 */
export function hasRequiredScopes(scopes: string[]): boolean {
  return REQUIRED_TIDAL_SCOPES.every((required) =>
    scopes.includes(required)
  );
}
