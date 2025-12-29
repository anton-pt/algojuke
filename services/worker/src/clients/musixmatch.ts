/**
 * Musixmatch API Client
 *
 * Fetches track lyrics using ISRC identifiers.
 * API Documentation: https://developer.musixmatch.com/
 */

import axios from "axios";
import { z } from "zod";
import { createAPIError, isNotFoundStatus } from "./errors.js";

/**
 * Musixmatch API base URL
 */
const MUSIXMATCH_BASE_URL = "https://api.musixmatch.com/ws/1.1";

/**
 * Musixmatch API key from environment
 */
const MUSIXMATCH_API_KEY = process.env.MUSIXMATCH_API_KEY ?? "";

/**
 * Musixmatch lyrics response schema
 */
export const MusixmatchLyricsResponseSchema = z.object({
  message: z.object({
    header: z.object({
      status_code: z.number(),
      execute_time: z.number(),
    }),
    body: z.object({
      lyrics: z
        .object({
          lyrics_id: z.number(),
          lyrics_body: z.string(),
          lyrics_language: z.string().optional(),
          explicit: z.number().optional(),
          lyrics_copyright: z.string().optional(),
          updated_time: z.string().optional(),
        })
        .optional(),
    }),
  }),
});

export type MusixmatchLyricsResponse = z.infer<
  typeof MusixmatchLyricsResponseSchema
>;

/**
 * Lyrics content extracted from response
 */
export interface LyricsContent {
  lyrics_body: string;
  lyrics_language?: string;
  explicit?: number;
}

/**
 * Musixmatch client interface
 */
export interface MusixmatchClient {
  getLyrics(isrc: string): Promise<LyricsContent | null>;
}

/**
 * Create Musixmatch API client
 *
 * @param apiKey - Optional API key override (uses MUSIXMATCH_API_KEY env var by default)
 * @returns Musixmatch client instance
 */
export function createMusixmatchClient(apiKey?: string): MusixmatchClient {
  const key = apiKey ?? MUSIXMATCH_API_KEY;

  if (!key) {
    throw new Error("MUSIXMATCH_API_KEY environment variable is not set");
  }

  return {
    async getLyrics(isrc: string): Promise<LyricsContent | null> {
      const url = `${MUSIXMATCH_BASE_URL}/track.lyrics.get`;

      try {
        const response = await axios.get(url, {
          params: {
            track_isrc: isrc,
            apikey: key,
          },
          timeout: 10000, // 10 second timeout
          validateStatus: () => true, // Handle all status codes
        });

        // Handle HTTP error status codes
        if (response.status >= 400) {
          // 404: Track not found - return null (graceful degradation)
          if (isNotFoundStatus(response.status)) {
            return null;
          }

          // 401: Invalid API key
          if (response.status === 401) {
            throw createAPIError(
              401,
              "Musixmatch",
              "Invalid Musixmatch API key"
            );
          }

          throw createAPIError(
            response.status,
            "Musixmatch",
            `Failed to fetch lyrics: ${response.statusText}`
          );
        }

        // Parse and validate response
        const parsed = MusixmatchLyricsResponseSchema.safeParse(response.data);

        if (!parsed.success) {
          console.warn(
            "Musixmatch response validation failed:",
            parsed.error.message
          );
          return null;
        }

        // Check Musixmatch API status code (inside response body)
        const apiStatusCode = parsed.data.message.header.status_code;

        // Status 404 in body: track not found
        if (apiStatusCode === 404) {
          return null;
        }

        // Status 401 in body: unauthorized
        if (apiStatusCode === 401) {
          throw createAPIError(401, "Musixmatch", "Invalid Musixmatch API key");
        }

        // Status 429 in body: rate limit
        if (apiStatusCode === 429) {
          throw createAPIError(
            429,
            "Musixmatch",
            "Musixmatch rate limit exceeded"
          );
        }

        // Non-success status
        if (apiStatusCode !== 200) {
          throw createAPIError(
            apiStatusCode,
            "Musixmatch",
            `Musixmatch API returned status ${apiStatusCode}`
          );
        }

        // No lyrics in response
        const lyrics = parsed.data.message.body.lyrics;
        if (!lyrics || !lyrics.lyrics_body) {
          return null;
        }

        return {
          lyrics_body: lyrics.lyrics_body,
          lyrics_language: lyrics.lyrics_language,
          explicit: lyrics.explicit,
        };
      } catch (error) {
        // Re-throw APIError as-is
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

        // Wrap other errors
        if (axios.isAxiosError(error)) {
          throw createAPIError(
            error.response?.status ?? 500,
            "Musixmatch",
            error.message
          );
        }

        throw createAPIError(
          500,
          "Musixmatch",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
  };
}
