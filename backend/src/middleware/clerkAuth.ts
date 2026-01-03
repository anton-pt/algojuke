/**
 * Clerk Authentication Middleware
 *
 * Provides middleware for protecting routes and checking user authorization.
 */

import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';
import { isApprovedUser } from '../config/allowlist.js';

/**
 * Initialize Clerk middleware for Express
 * This populates req.auth with the user's authentication state
 */
export { clerkMiddleware };

/**
 * Get Clerk client for backend operations
 */
export { clerkClient };

/**
 * Middleware that requires the user to be authenticated
 * Returns 401 if not authenticated
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const auth = getAuth(req);

  if (!auth?.userId) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  next();
}

/**
 * Middleware that requires the user to be on the approved allowlist
 * Returns 401 if not authenticated, 403 if not approved
 */
export async function requireApproved(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = getAuth(req);

  if (!auth?.userId) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const email = user.primaryEmailAddress?.emailAddress;

    if (!email || !isApprovedUser(email)) {
      res.status(403).json({
        error: 'forbidden',
        message: 'User not approved for beta access',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking user approval:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to verify user status',
    });
  }
}

/**
 * Helper to get the current user's auth object
 */
export { getAuth };
