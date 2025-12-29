# API Contracts: Track Ingestion Pipeline

**Feature**: 006-track-ingestion-pipeline
**Date**: 2025-12-29

## External APIs

### ReccoBeats Audio Features

**Endpoint**: `GET https://api.reccobeats.com/v1/audio-features`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isrc` | string | Yes | ISO 3901 ISRC |

**Response Schema**:
```typescript
import { z } from "zod";

export const ReccoBeatsAudioFeaturesResponse = z.object({
  data: z.array(z.object({
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
  })),
});

export type ReccoBeatsAudioFeaturesResponse = z.infer<typeof ReccoBeatsAudioFeaturesResponse>;
```

**Response Codes**:
- `200`: Success (may return empty array)
- `400`: Bad request (invalid ISRC format)
- `429`: Rate limit exceeded

**Client Interface**:
```typescript
export interface ReccoBeatsClient {
  getAudioFeatures(isrc: string): Promise<AudioFeatures | null>;
}
```

---

### Musixmatch Lyrics

**Endpoint**: `GET https://api.musixmatch.com/ws/1.1/track.lyrics.get`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `track_isrc` | string | Yes | ISO 3901 ISRC |
| `apikey` | string | Yes | Musixmatch API key |

**Response Schema**:
```typescript
export const MusixmatchLyricsResponse = z.object({
  message: z.object({
    header: z.object({
      status_code: z.number(),
      execute_time: z.number(),
    }),
    body: z.object({
      lyrics: z.object({
        lyrics_id: z.number(),
        lyrics_body: z.string(),
        lyrics_language: z.string().optional(),
        explicit: z.number().optional(),
        lyrics_copyright: z.string().optional(),
        updated_time: z.string().optional(),
      }).optional(),
    }),
  }),
});

export type MusixmatchLyricsResponse = z.infer<typeof MusixmatchLyricsResponse>;
```

**Response Codes**:
- `200`: Success (body.lyrics may be undefined if not found)
- `401`: Invalid API key
- `404`: Track not found

**Client Interface**:
```typescript
export interface MusixmatchClient {
  getLyrics(isrc: string): Promise<LyricsContent | null>;
}

export interface LyricsContent {
  lyrics_body: string;
  lyrics_language?: string;
  explicit?: number;
}
```

---

### TEI Embedding Service

**Endpoint**: `POST http://localhost:8080/embed`

**Request Schema**:
```typescript
export const TEIEmbedRequest = z.object({
  inputs: z.union([z.string(), z.array(z.string())]),
});

export type TEIEmbedRequest = z.infer<typeof TEIEmbedRequest>;
```

**Response Schema**:
```typescript
// For single input: returns array of numbers (the embedding)
// For multiple inputs: returns array of arrays
export const TEIEmbedResponse = z.array(z.array(z.number()));

export type TEIEmbedResponse = z.infer<typeof TEIEmbedResponse>;
```

**Response Codes**:
- `200`: Success
- `400`: Invalid input
- `503`: Model not loaded

**Client Interface**:
```typescript
export interface TEIClient {
  embed(text: string): Promise<number[]>;
  embedWithInstruct(query: string, instruct: string): Promise<number[]>;
}
```

**Embedding Format** (with instruction):
```typescript
const formattedInput = `Instruct: ${instruct}\nQuery: ${text}`;
```

---

## Internal APIs

### Qdrant Track Document Upsert

Uses existing `services/search-index` client.

**Interface**:
```typescript
import { TrackDocument } from "@algojuke/search-index";

export interface QdrantClient {
  upsertTrack(document: TrackDocument): Promise<void>;
  getTrackByISRC(isrc: string): Promise<TrackDocument | null>;
}
```

---

### Anthropic LLM (via Vercel AI SDK)

**Interface**:
```typescript
export interface InterpretationResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMClient {
  generateInterpretation(
    title: string,
    artist: string,
    album: string,
    lyrics: string
  ): Promise<InterpretationResult>;
}
```

**Implementation**:
```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: buildInterpretationPrompt(title, artist, album, lyrics),
});

return {
  text: result.text,
  model: 'claude-sonnet-4-20250514',
  inputTokens: result.usage.promptTokens,
  outputTokens: result.usage.completionTokens,
};
```

---

## Error Handling

All clients throw typed errors for consistent handling:

```typescript
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly service: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Retryable errors (Inngest will retry the step)
export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof APIError) {
    return error.retryable;
  }
  // Network errors are retryable
  if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
    return true;
  }
  return false;
};
```

**Retryable Status Codes**:
- `429`: Rate limit (always retryable)
- `500`, `502`, `503`, `504`: Server errors (retryable)
- `408`: Timeout (retryable)

**Non-Retryable Status Codes**:
- `400`: Bad request (fix input)
- `401`: Unauthorized (fix API key)
- `404`: Not found (graceful degradation)
