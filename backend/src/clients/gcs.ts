/**
 * GCS Audio Storage Client (Backend Service)
 *
 * Generates signed URLs for audio files stored in Google Cloud Storage.
 * This is Ticket 6 of the Radio Station Phase 1 implementation.
 *
 * The backend service uses this client to generate signed URLs on-demand
 * when users request playback. This ensures mixes remain accessible
 * indefinitely (until explicitly deleted), not just for 24 hours after generation.
 */

import { Storage } from "@google-cloud/storage";
import { z } from "zod";
import { createAPIError, APIError } from "./errors.js";

/**
 * GCS project ID from environment
 */
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID ?? "";

/**
 * GCS bucket name from environment
 */
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? "";

/**
 * Default signed URL expiry in hours
 */
const DEFAULT_EXPIRY_HOURS = 24;

/**
 * Maximum signed URL expiry in hours (7 days)
 */
const MAX_EXPIRY_HOURS = 168;

/**
 * GCS client interface for backend service
 */
export interface GCSClient {
  getSignedUrl(path: string, expiryHours?: number): Promise<string>;
}

/**
 * Zod schema for path validation
 *
 * Paths must:
 * - Be non-empty
 * - Contain only alphanumeric characters, hyphens, underscores, slashes, and dots
 */
export const PathSchema = z
  .string()
  .min(1, "Path cannot be empty")
  .regex(/^[a-zA-Z0-9\-_/.]+$/, "Path contains invalid characters");

/**
 * Zod schema for getSignedUrl input validation
 */
export const GetSignedUrlInputSchema = z.object({
  path: PathSchema,
  expiryHours: z
    .number()
    .min(1, "Expiry must be at least 1 hour")
    .max(MAX_EXPIRY_HOURS, `Expiry cannot exceed ${MAX_EXPIRY_HOURS} hours`)
    .optional()
    .default(DEFAULT_EXPIRY_HOURS),
});

export type GetSignedUrlInput = z.infer<typeof GetSignedUrlInputSchema>;

/**
 * Map GCS errors to APIError with correct retryable flag
 *
 * GCS error handling:
 * - 401, 403: Authentication/permission errors, non-retryable
 * - 404: Bucket/file not found, non-retryable
 * - 408, 429, 5xx: Transient errors, retryable
 * - Network errors: Retryable
 *
 * @param error - The error thrown by GCS SDK
 * @returns APIError with appropriate retryable flag
 */
export function mapGCSError(error: unknown): APIError {
  // Handle GCS SDK errors with status code
  if (error instanceof Error) {
    const errorWithCode = error as Error & {
      code?: number | string;
      status?: number;
      statusCode?: number;
    };

    // Extract status code from various properties
    const rawCode = errorWithCode.code;
    const status =
      typeof rawCode === "number"
        ? rawCode
        : (errorWithCode.status ??
          errorWithCode.statusCode ??
          (typeof rawCode === "string" ? parseInt(rawCode, 10) : NaN));

    if (!isNaN(status) && status >= 100 && status < 600) {
      return createAPIError(status, "GCS", error.message);
    }

    // Check for specific error codes
    if (typeof rawCode === "string") {
      // Network errors
      if (
        rawCode === "ECONNREFUSED" ||
        rawCode === "ENOTFOUND" ||
        rawCode === "ETIMEDOUT" ||
        rawCode === "ECONNRESET"
      ) {
        return createAPIError(503, "GCS", `Network error: ${error.message}`);
      }
    }

    // Check for timeout in message
    if (error.message.toLowerCase().includes("timeout")) {
      return createAPIError(408, "GCS", error.message);
    }

    // Check for common error patterns in message
    const message = error.message.toLowerCase();
    if (
      message.includes("unauthorized") ||
      message.includes("invalid credentials")
    ) {
      return createAPIError(401, "GCS", error.message);
    }
    if (
      message.includes("forbidden") ||
      message.includes("permission denied")
    ) {
      return createAPIError(403, "GCS", error.message);
    }
    if (message.includes("not found")) {
      return createAPIError(404, "GCS", error.message);
    }
  }

  // Unknown errors - treat as retryable server error
  return createAPIError(
    500,
    "GCS",
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Create GCS client for signed URL generation
 *
 * @param projectId - Optional GCS project ID override (uses GCS_PROJECT_ID env var by default)
 * @param bucketName - Optional bucket name override (uses GCS_BUCKET_NAME env var by default)
 * @returns GCSClient instance
 * @throws Error if project ID or bucket name is not provided and not in environment
 */
export function createGCSClient(
  projectId?: string,
  bucketName?: string,
): GCSClient {
  const project = projectId ?? GCS_PROJECT_ID;
  const bucket = bucketName ?? GCS_BUCKET_NAME;

  if (!project) {
    throw new Error("GCS_PROJECT_ID environment variable is not set");
  }

  if (!bucket) {
    throw new Error("GCS_BUCKET_NAME environment variable is not set");
  }

  // Initialize the GCS client
  const storage = new Storage({ projectId: project });
  const bucketRef = storage.bucket(bucket);

  return {
    async getSignedUrl(path: string, expiryHours?: number): Promise<string> {
      // Validate input
      const parseResult = GetSignedUrlInputSchema.safeParse({
        path,
        expiryHours,
      });

      if (!parseResult.success) {
        const errorMessage = parseResult.error.issues
          .map((e) => e.message)
          .join(", ");
        throw createAPIError(422, "GCS", errorMessage);
      }

      const validatedExpiry = parseResult.data.expiryHours;

      try {
        const file = bucketRef.file(path);

        // Generate signed URL with expiry
        const [signedUrl] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + validatedExpiry * 60 * 60 * 1000, // Convert hours to ms
        });

        return signedUrl;
      } catch (error) {
        // Re-throw APIError as-is
        if (error instanceof APIError) {
          throw error;
        }

        // Map GCS errors to APIError
        throw mapGCSError(error);
      }
    },
  };
}
