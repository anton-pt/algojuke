/**
 * Clerk Authentication Middleware
 *
 * Provides middleware for protecting routes and checking user authentication.
 */

import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

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
  next: NextFunction,
): void {
  const auth = getAuth(req);

  if (!auth?.userId) {
    res.status(401).json({
      error: "unauthorized",
      message: "Authentication required",
    });
    return;
  }

  next();
}

/**
 * Helper to get the current user's auth object
 */
export { getAuth };
