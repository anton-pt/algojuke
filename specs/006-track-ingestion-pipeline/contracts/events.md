# Event Contracts: Track Ingestion Pipeline

**Feature**: 006-track-ingestion-pipeline
**Date**: 2025-12-29

## Inngest Events

### track/ingestion.requested

Triggers the track ingestion pipeline.

```typescript
import { z } from "zod";

export const TrackIngestionRequestedEvent = z.object({
  name: z.literal("track/ingestion.requested"),
  data: z.object({
    /**
     * ISO 3901 ISRC (12 alphanumeric characters)
     * @example "USRC11700001"
     */
    isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i),

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
     * Priority modifier (-600 to +600 seconds)
     * Positive values = higher priority
     * @default 0
     */
    priority: z.number().int().min(-600).max(600).optional(),

    /**
     * Override idempotency, force re-ingestion
     * @default false
     */
    force: z.boolean().optional(),
  }),
});

export type TrackIngestionRequestedEvent = z.infer<
  typeof TrackIngestionRequestedEvent
>["data"];
```

**Example Payload**:
```json
{
  "name": "track/ingestion.requested",
  "data": {
    "isrc": "USRC11700001",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "album": "A Night at the Opera",
    "priority": 0,
    "force": false
  }
}
```

---

### track/ingestion.completed

Emitted upon successful pipeline completion.

```typescript
export const TrackIngestionCompletedEvent = z.object({
  name: z.literal("track/ingestion.completed"),
  data: z.object({
    /**
     * ISRC of ingested track
     */
    isrc: z.string(),

    /**
     * Inngest function run ID
     */
    runId: z.string(),

    /**
     * Completion timestamp (Unix epoch ms)
     */
    completedAt: z.number().int().positive(),

    /**
     * Total execution time in milliseconds
     */
    durationMs: z.number().int().positive(),

    /**
     * Summary of ingested data
     */
    result: z.object({
      hasLyrics: z.boolean(),
      hasAudioFeatures: z.boolean(),
      hasInterpretation: z.boolean(),
      embeddingDimensions: z.number().int(),
    }),
  }),
});

export type TrackIngestionCompletedEvent = z.infer<
  typeof TrackIngestionCompletedEvent
>["data"];
```

---

### track/ingestion.failed

Emitted when pipeline permanently fails (after exhausting retries).

```typescript
export const TrackIngestionFailedEvent = z.object({
  name: z.literal("track/ingestion.failed"),
  data: z.object({
    /**
     * ISRC of failed track
     */
    isrc: z.string(),

    /**
     * Inngest function run ID
     */
    runId: z.string(),

    /**
     * Error message
     */
    error: z.string(),

    /**
     * Step that caused final failure
     */
    failedStep: z.enum([
      "fetch-audio-features",
      "fetch-lyrics",
      "generate-interpretation",
      "embed-interpretation",
      "store-document",
    ]).optional(),

    /**
     * Number of retry attempts made
     */
    retries: z.number().int().nonnegative(),

    /**
     * Failure timestamp (Unix epoch ms)
     */
    failedAt: z.number().int().positive(),
  }),
});

export type TrackIngestionFailedEvent = z.infer<
  typeof TrackIngestionFailedEvent
>["data"];
```

---

## Event Schemas Collection

```typescript
import { EventSchemas } from "inngest";

export const trackIngestionEvents = new EventSchemas().fromZod({
  "track/ingestion.requested": {
    data: TrackIngestionRequestedEvent.shape.data,
  },
  "track/ingestion.completed": {
    data: TrackIngestionCompletedEvent.shape.data,
  },
  "track/ingestion.failed": {
    data: TrackIngestionFailedEvent.shape.data,
  },
});
```

---

## Usage

```typescript
import { inngest } from "./client";

// Trigger ingestion
await inngest.send({
  name: "track/ingestion.requested",
  data: {
    isrc: "USRC11700001",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
  },
});
```
