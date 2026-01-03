/**
 * Auth API Routes
 *
 * Endpoints for authentication status and Tidal token management.
 */

import { Router, Request, Response } from 'express';
import { getAuth, clerkClient } from '../middleware/clerkAuth.js';
import { requireAuth, requireApproved } from '../middleware/clerkAuth.js';
import { isApprovedUser } from '../config/allowlist.js';
import {
  getTidalTokens,
  storeTidalTokens,
  hasTidalConnection,
  isTokenExpired,
  refreshTidalTokens,
} from '../services/tidalAuthService.js';
import {
  TidalTokensInputSchema,
  hasRequiredScopes,
  REQUIRED_TIDAL_SCOPES,
  type AuthStatus,
  type TidalTokensResponse,
  type TidalTokenStatus,
} from '../schemas/auth.js';

/**
 * Create auth routes
 */
export function createAuthRoutes(): Router {
  const router = Router();

  /**
   * GET /api/auth/status
   * Get current user's authentication status
   */
  router.get('/status', async (req: Request, res: Response) => {
    const auth = getAuth(req);

    // Not authenticated
    if (!auth?.userId) {
      const response: AuthStatus = {
        isAuthenticated: false,
        isApproved: false,
        hasTidalConnection: false,
      };
      res.json(response);
      return;
    }

    try {
      const user = await clerkClient.users.getUser(auth.userId);
      const email = user.primaryEmailAddress?.emailAddress;
      const approved = email ? isApprovedUser(email) : false;
      const hasTidal = await hasTidalConnection(auth.userId);

      // Check if token is expired (for frontend to trigger refresh)
      let tidalTokenExpired: boolean | undefined;
      if (hasTidal) {
        const expired = await isTokenExpired(auth.userId);
        tidalTokenExpired = expired ?? undefined;
      }

      const response: AuthStatus & { tidalTokenExpired?: boolean } = {
        isAuthenticated: true,
        isApproved: approved,
        hasTidalConnection: hasTidal,
        tidalTokenExpired,
        email: email,
        userId: auth.userId,
      };
      res.json(response);
    } catch (error) {
      console.error('Error fetching auth status:', error);
      res.status(500).json({
        error: 'internal_error',
        message: 'Failed to fetch auth status',
      });
    }
  });

  /**
   * POST /api/auth/tidal/tokens
   * Store Tidal OAuth tokens (requires approved user)
   */
  router.post(
    '/tidal/tokens',
    requireAuth,
    requireApproved,
    async (req: Request, res: Response) => {
      const auth = getAuth(req);

      // Validate request body
      const parsed = TidalTokensInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'validation_error',
          message: 'Invalid token data',
          details: parsed.error.issues,
        });
        return;
      }

      // Validate that all required scopes are present (FR-006)
      if (!hasRequiredScopes(parsed.data.scopes)) {
        res.status(400).json({
          error: 'insufficient_scopes',
          message: 'Missing required Tidal scopes',
          requiredScopes: REQUIRED_TIDAL_SCOPES,
          providedScopes: parsed.data.scopes,
        });
        return;
      }

      try {
        const connectedAt = await storeTidalTokens(auth!.userId!, parsed.data);

        const response: TidalTokensResponse = {
          success: true,
          connectedAt,
        };
        res.json(response);
      } catch (error) {
        console.error('Error storing Tidal tokens:', error);
        res.status(500).json({
          error: 'internal_error',
          message: 'Failed to store Tidal tokens',
        });
      }
    }
  );

  /**
   * GET /api/auth/tidal/tokens
   * Get Tidal token status (does not return actual tokens)
   */
  router.get('/tidal/tokens', requireAuth, async (req: Request, res: Response) => {
    const auth = getAuth(req);

    try {
      const tokens = await getTidalTokens(auth!.userId!);

      if (!tokens) {
        const response: TidalTokenStatus = {
          hasTokens: false,
        };
        res.json(response);
        return;
      }

      const expired = await isTokenExpired(auth!.userId!);

      const response: TidalTokenStatus = {
        hasTokens: true,
        expiresAt: tokens.expiresAt,
        isExpired: expired ?? undefined,
        scopes: tokens.scopes,
      };
      res.json(response);
    } catch (error) {
      console.error('Error fetching Tidal token status:', error);
      res.status(500).json({
        error: 'internal_error',
        message: 'Failed to fetch Tidal token status',
      });
    }
  });

  /**
   * POST /api/auth/tidal/refresh
   * Refresh Tidal access token
   *
   * Can be called two ways:
   * 1. With body: Updates stored tokens with new values from SDK refresh
   * 2. Without body: Returns current token status (for checking expiration)
   */
  router.post(
    '/tidal/refresh',
    requireAuth,
    requireApproved,
    async (req: Request, res: Response) => {
      const auth = getAuth(req);

      try {
        // Check if tokens are provided (frontend refreshed via SDK)
        const hasBody = req.body && Object.keys(req.body).length > 0;

        if (hasBody) {
          // Validate and update tokens
          const parsed = TidalTokensInputSchema.safeParse(req.body);
          if (!parsed.success) {
            res.status(400).json({
              error: 'validation_error',
              message: 'Invalid token data',
              details: parsed.error.issues,
            });
            return;
          }

          // Use refreshTidalTokens which includes structured logging
          const result = await refreshTidalTokens(auth!.userId!, parsed.data);

          const response: TidalTokenStatus = {
            hasTokens: true,
            expiresAt: result.expiresAt,
            isExpired: false,
            scopes: parsed.data.scopes,
          };
          res.json(response);
          return;
        }

        // No body - just return current token status
        const tokens = await getTidalTokens(auth!.userId!);

        if (!tokens) {
          res.status(422).json({
            error: 'no_connection',
            message: 'No Tidal connection found',
          });
          return;
        }

        const expired = await isTokenExpired(auth!.userId!);

        const response: TidalTokenStatus = {
          hasTokens: true,
          expiresAt: tokens.expiresAt,
          isExpired: expired ?? undefined,
          scopes: tokens.scopes,
        };
        res.json(response);
      } catch (error) {
        console.error('Error refreshing Tidal tokens:', error);
        res.status(500).json({
          error: 'internal_error',
          message: 'Failed to refresh Tidal tokens',
        });
      }
    }
  );

  return router;
}
