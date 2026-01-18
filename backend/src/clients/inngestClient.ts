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
  isrc: z
    .string()
    .length(12)
    .regex(/^[A-Z0-9]{12}$/i, {
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

/**
 * Article input schema for mix generation
 */
const MixArticleSchema = z.object({
  /**
   * Readwise document ID
   */
  documentId: z.string().min(1),

  /**
   * How to process the content
   */
  contentMode: z.enum(["summary", "excerpt", "full"]),
});

/**
 * Event: mix/generation.requested
 *
 * Triggers the DJ agent to generate a radio mix. Sent by the generateMix
 * agent tool when a user requests a mix from chat.
 */
export const MixGenerationRequestedEventSchema = z.object({
  /**
   * Mix UUID created by generateMix tool
   */
  mixId: z.string().uuid(),

  /**
   * User ID (Clerk user ID)
   */
  userId: z.string().min(1),

  /**
   * Mix title provided by user
   */
  title: z.string().min(1).max(255),

  /**
   * Optional mix description
   */
  description: z.string().max(1000).nullable().optional(),

  /**
   * Articles to include in the mix (1-10)
   */
  articles: z.array(MixArticleSchema).min(1).max(10),

  /**
   * Natural language music instructions for the DJ agent.
   */
  musicInstructions: z.string().max(2000).nullable().optional(),

  /**
   * Conversation ID for linking back to chat context
   */
  conversationId: z.string().uuid().nullable().optional(),

  /**
   * Priority modifier (-600 to +600 seconds)
   */
  priority: PriorityModifier.optional(),
});

export type MixGenerationRequestedEvent = z.infer<
  typeof MixGenerationRequestedEventSchema
>;

// ============================================================================
// Event Schema Collection
// ============================================================================

/**
 * Backend event schemas for Inngest client
 *
 * Note: Type assertion is needed because Inngest's types expect Zod v3
 * but we're using Zod v4. Runtime behavior is unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
const backendEvents = new EventSchemas().fromZod({
  "track/ingestion.requested": {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    data: TrackIngestionRequestedEventSchema as any,
  },
  "mix/generation.requested": {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    data: MixGenerationRequestedEventSchema as any,
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
  data: TrackIngestionRequestedEvent,
): Promise<void> {
  await inngest.send({
    name: "track/ingestion.requested",
    data,
  });
}

/**
 * Helper to send mix generation event
 *
 * Feature: ALG-83
 *
 * @param data - Mix generation request data
 * @returns Promise<void>
 */
export async function sendMixGenerationEvent(
  data: MixGenerationRequestedEvent,
): Promise<void> {
  await inngest.send({
    name: "mix/generation.requested",
    data,
  });
}
