/**
 * Track document schema for Qdrant vector index
 *
 * Defines the structure and validation for music track documents stored in Qdrant.
 * Each document represents a single track with metadata, lyrics, interpretation,
 * embedding vector, and optional audio features.
 */

import { z } from 'zod';

/**
 * Zod schema for Track Document
 *
 * Validates all fields according to data-model.md specifications:
 * - Required fields: ISRC, title, artist, album, interpretation_embedding
 * - Optional text fields: lyrics, interpretation
 * - Optional audio features: 11 fields from reccobeats.com API
 */
export const TrackDocumentSchema = z.object({
  // Required core metadata
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
    message: 'ISRC must be 12 alphanumeric characters (ISO 3901)',
  }),
  title: z.string().min(1, { message: 'Title is required' }),
  artist: z.string().min(1, { message: 'Artist is required' }),
  album: z.string().min(1, { message: 'Album is required' }),

  // Optional text fields
  lyrics: z.string().nullable().optional(),
  interpretation: z.string().nullable().optional(),

  // Vector embedding (4096-dimensional from Qwen3-Embedding-8B)
  interpretation_embedding: z
    .array(z.number())
    .length(4096, {
      message: 'Embedding must be exactly 4096 dimensions (Qwen3-Embedding-8B)',
    })
    .describe('Dense vector for semantic search'),

  // Optional audio features from reccobeats.com API
  // All features are nullable to handle missing data

  // Acoustic vs electronic (0.0 = electronic, 1.0 = acoustic)
  acousticness: z.number().min(0).max(1).nullable().optional(),

  // Suitability for dancing based on tempo, rhythm, beat
  danceability: z.number().min(0).max(1).nullable().optional(),

  // Intensity and liveliness
  energy: z.number().min(0).max(1).nullable().optional(),

  // Likelihood of no vocals (>0.5 = likely instrumental)
  instrumentalness: z.number().min(0).max(1).nullable().optional(),

  // Pitch class notation (-1 = no key detected, 0 = C, 1 = C♯/D♭, ..., 11 = B)
  key: z.number().int().min(-1).max(11).nullable().optional(),

  // Probability of live audience presence (>0.8 = high confidence live)
  liveness: z.number().min(0).max(1).nullable().optional(),

  // Average loudness in decibels
  loudness: z.number().min(-60).max(0).nullable().optional(),

  // Musical mode (0 = minor, 1 = major)
  mode: z.union([z.literal(0), z.literal(1)]).nullable().optional(),

  // Presence of spoken words (>0.66 = speech-like content)
  speechiness: z.number().min(0).max(1).nullable().optional(),

  // Beats per minute
  tempo: z.number().min(0).max(250).nullable().optional(),

  // Musical positivity (0 = sad/dark, 1 = happy/uplifting)
  valence: z.number().min(0).max(1).nullable().optional(),
});

/**
 * TypeScript type inferred from Zod schema
 */
export type TrackDocument = z.infer<typeof TrackDocumentSchema>;

/**
 * Payload-only schema (without vector, for Qdrant payload operations)
 */
export const TrackPayloadSchema = TrackDocumentSchema.omit({
  interpretation_embedding: true,
});

export type TrackPayload = z.infer<typeof TrackPayloadSchema>;

/**
 * Validate track document against schema
 * @param data - Data to validate
 * @returns Validated and typed track document
 * @throws ZodError if validation fails
 */
export function validateTrackDocument(data: unknown): TrackDocument {
  return TrackDocumentSchema.parse(data);
}

/**
 * Safe validation that returns success/error result
 * @param data - Data to validate
 * @returns Validation result with typed data or error
 */
export function safeValidateTrackDocument(data: unknown) {
  return TrackDocumentSchema.safeParse(data);
}
