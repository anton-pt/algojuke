/**
 * Type augmentations for Express Request with Clerk auth
 *
 * @clerk/express automatically adds auth property to Request,
 * but we declare it explicitly for better type inference.
 */

import { AuthObject } from '@clerk/express';

declare global {
  namespace Express {
    interface Request {
      /**
       * Clerk auth object containing userId, sessionId, and claims.
       * Populated by clerkMiddleware().
       */
      auth?: AuthObject;
    }
  }
}

export {};
