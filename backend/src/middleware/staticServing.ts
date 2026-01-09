/**
 * Static Serving Middleware for SPA
 *
 * Serves frontend static files in production mode with SPA fallback routing.
 * API routes must be registered BEFORE this middleware to ensure they take priority.
 */

import express, { Express, Request, Response } from "express";
import { existsSync } from "fs";
import { join } from "path";

export interface StaticServingConfig {
  /** Path to the public directory containing static files */
  publicPath: string;
  /** Whether static serving is enabled (typically NODE_ENV === 'production') */
  enabled: boolean;
}

/**
 * Determines if static serving should be enabled based on environment and file existence.
 */
export function shouldEnableStaticServing(
  nodeEnv: string | undefined,
  publicPath: string,
): boolean {
  // Only enable in production
  if (nodeEnv !== "production") {
    return false;
  }

  // Check if index.html exists in the public path
  const indexPath = join(publicPath, "index.html");
  return existsSync(indexPath);
}

/**
 * Checks if a request path matches an API route that should not be caught by SPA fallback.
 * API routes include: /health, /graphql, /api/*
 */
export function isApiRoute(path: string): boolean {
  // Normalize path - remove trailing slashes and ensure leading slash
  const normalizedPath = "/" + path.replace(/^\/+|\/+$/g, "");

  // API route patterns that should NOT be caught by SPA fallback
  const apiPatterns = [
    /^\/health$/,
    /^\/graphql$/,
    /^\/api(\/|$)/, // /api or /api/*
  ];

  return apiPatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Creates the SPA fallback handler that serves index.html for client-side routes.
 * This handler sets no-cache headers to ensure users always get the latest HTML.
 */
export function createSpaFallbackHandler(publicPath: string) {
  return (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(join(publicPath, "index.html"));
  };
}

/**
 * Applies static serving middleware to an Express app.
 * Must be called AFTER all API routes are registered.
 *
 * @param app - Express application instance
 * @param config - Static serving configuration
 * @returns true if middleware was applied, false otherwise
 */
export function applyStaticServing(
  app: Express,
  config: StaticServingConfig,
): boolean {
  if (!config.enabled) {
    return false;
  }

  // Verify public path exists
  if (!existsSync(config.publicPath)) {
    console.warn(
      `Static serving enabled but public path does not exist: ${config.publicPath}`,
    );
    return false;
  }

  // Serve static assets with long cache (Vite adds content hashes)
  app.use(
    express.static(config.publicPath, {
      maxAge: "1y",
      index: false, // Don't auto-serve index.html for directory requests
    }),
  );

  // SPA fallback - all unmatched GET requests serve index.html
  // Using regex for compatibility with both path-to-regexp v0.x and v8.x
  app.get(/^\/.*/, createSpaFallbackHandler(config.publicPath));

  console.log(`Static serving enabled from: ${config.publicPath}`);
  return true;
}

/**
 * Gets the default public path relative to the dist directory.
 * In production, this is /app/dist/../public = /app/public
 */
export function getDefaultPublicPath(dirname: string): string {
  return join(dirname, "../public");
}
