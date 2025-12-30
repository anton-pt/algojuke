/**
 * Inngest Client for Backend Service
 *
 * Provides typed event sending for track ingestion scheduling.
 * Events are sent to the worker service via Inngest.
 */

import { Inngest, EventSchemas } from "inngest";
import { z } from "zod";

// ============================================================================
// Event Schemas
// ============================================================================

/**
 * Priority modifier for tasks
 * Range: -600 to +600 seconds (Inngest priority range)
 */
const PriorityModifier = z
  .number()
  .int()
  .min(-600)
  .max(600)
  .describe("Priority modifier in seconds (-600 to +600)");

/**
 * Event: track/ingestion.requested
 *
 * Triggers the track ingestion pipeline in the worker service.
 */
export const TrackIngestionRequestedEventSchema = z.object({
  /**
   * ISO 3901 ISRC (12 alphanumeric characters)
   */
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
    message: "ISRC must be 12 alphanumeric characters",
  }),

  /**
   * Track title from Tidal API
   */
  title: z.string().min(1),

  /**
   * Artist name from Tidal API
   */
  artist: z.string().min(1),

  /**
   * Album name from Tidal API
   */
  album: z.string().min(1),

  /**
   * Album artwork URL from Tidal API (optional)
   */
  artworkUrl: z.string().url().optional().nullable(),

  /**
   * Priority modifier (-600 to +600 seconds)
   * Positive values = higher priority
   */
  priority: PriorityModifier.optional(),

  /**
   * Override idempotency, force re-ingestion
   */
  force: z.boolean().optional(),
});

export type TrackIngestionRequestedEvent = z.infer<
  typeof TrackIngestionRequestedEventSchema
>;

// ============================================================================
// Event Schema Collection
// ============================================================================

/**
 * Backend event schemas for Inngest client
 */
const backendEvents = new EventSchemas().fromZod({
  "track/ingestion.requested": {
    data: TrackIngestionRequestedEventSchema,
  },
});

// ============================================================================
// Inngest Client
// ============================================================================

/**
 * Inngest client for the backend service
 *
 * Configuration:
 * - id: algojuke-backend (separate from worker for routing)
 * - schemas: Typed event schemas for compile-time safety
 */
export const inngest = new Inngest({
  id: "algojuke-backend",
  schemas: backendEvents,
});

/**
 * Helper to send track ingestion event
 *
 * @param data - Track data to schedule for ingestion
 * @returns Promise<void>
 */
export async function sendTrackIngestionEvent(
  data: TrackIngestionRequestedEvent
): Promise<void> {
  await inngest.send({
    name: "track/ingestion.requested",
    data,
  });
}
