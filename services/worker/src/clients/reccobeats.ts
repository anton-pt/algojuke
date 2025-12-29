/**
 * ReccoBeats API Client
 *
 * Fetches audio features for tracks using ISRC identifiers.
 * API Documentation: https://reccobeats.com/docs/apis/get-audio-features
 */

import axios from "axios";
import { z } from "zod";
import { createAPIError, isNotFoundStatus } from "./errors.js";

/**
 * ReccoBeats API base URL
 */
const RECCOBEATS_BASE_URL = "https://api.reccobeats.com/v1";

/**
 * Audio features response schema from ReccoBeats API
 */
export const ReccoBeatsAudioFeaturesResponseSchema = z.object({
  content: z.array(
    z.object({
      id: z.string().optional(),
      href: z.string().optional(),
      isrc: z.string(),
      acousticness: z.number().min(0).max(1).nullable(),
      danceability: z.number().min(0).max(1).nullable(),
      energy: z.number().min(0).max(1).nullable(),
      instrumentalness: z.number().min(0).max(1).nullable(),
      key: z.number().int().min(-1).max(11).nullable(),
      liveness: z.number().min(0).max(1).nullable(),
      loudness: z.number().min(-60).max(0).nullable(),
      mode: z.union([z.literal(0), z.literal(1)]).nullable(),
      speechiness: z.number().min(0).max(1).nullable(),
      tempo: z.number().min(0).max(250).nullable(),
      valence: z.number().min(0).max(1).nullable(),
    })
  ),
});

export type ReccoBeatsAudioFeaturesResponse = z.infer<
  typeof ReccoBeatsAudioFeaturesResponseSchema
>;

/**
 * Audio features extracted from response
 */
export interface AudioFeatures {
  acousticness: number | null;
  danceability: number | null;
  energy: number | null;
  instrumentalness: number | null;
  key: number | null;
  liveness: number | null;
  loudness: number | null;
  mode: 0 | 1 | null;
  speechiness: number | null;
  tempo: number | null;
  valence: number | null;
}

/**
 * ReccoBeats client interface
 */
export interface ReccoBeatsClient {
  getAudioFeatures(isrc: string): Promise<AudioFeatures | null>;
}

/**
 * Create ReccoBeats API client
 *
 * @returns ReccoBeats client instance
 */
export function createReccoBeatsClient(): ReccoBeatsClient {
  return {
    async getAudioFeatures(isrc: string): Promise<AudioFeatures | null> {
      const url = `${RECCOBEATS_BASE_URL}/audio-features`;

      try {
        const response = await axios.get(url, {
          params: { ids: isrc },
          timeout: 10000, // 10 second timeout
          validateStatus: () => true, // Handle all status codes
        });

        // Handle error status codes
        if (response.status >= 400) {
          // 404 or empty results: return null (graceful degradation)
          if (isNotFoundStatus(response.status)) {
            return null;
          }

          // 429: Rate limit exceeded (retryable)
          if (response.status === 429) {
            throw createAPIError(
              429,
              "ReccoBeats",
              "ReccoBeats rate limit exceeded"
            );
          }

          throw createAPIError(
            response.status,
            "ReccoBeats",
            `Failed to fetch audio features: ${response.statusText}`
          );
        }

        // Parse and validate response
        const parsed = ReccoBeatsAudioFeaturesResponseSchema.safeParse(
          response.data
        );

        if (!parsed.success) {
          // Log warning but don't throw - treat as no data
          console.warn(
            "ReccoBeats response validation failed:",
            parsed.error.message
          );
          return null;
        }

        // Handle empty results array
        if (parsed.data.content.length === 0) {
          return null;
        }

        // Handle multiple results - use first, log warning
        if (parsed.data.content.length > 1) {
          console.warn(
            `ReccoBeats returned ${parsed.data.content.length} results for ISRC ${isrc}, using first result`
          );
        }

        const features = parsed.data.content[0];
        return {
          acousticness: features.acousticness,
          danceability: features.danceability,
          energy: features.energy,
          instrumentalness: features.instrumentalness,
          key: features.key,
          liveness: features.liveness,
          loudness: features.loudness,
          mode: features.mode,
          speechiness: features.speechiness,
          tempo: features.tempo,
          valence: features.valence,
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
            "ReccoBeats",
            error.message
          );
        }

        throw createAPIError(
          500,
          "ReccoBeats",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
  };
}
