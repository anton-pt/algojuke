import { Request, Response, NextFunction } from "express";

// Allow handlers to return Response (from res.json/res.send) or void
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next?: NextFunction,
) => Promise<void | Response>;

/**
 * Wraps an async Express route handler to properly handle promise rejections.
 * Converts `async (req, res, next?) => Promise<void>` to `(req, res, next) => void`.
 * This satisfies ESLint's no-misused-promises rule.
 */
export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
