# Data Model: Agent Tool Optimization

**Feature**: 013-agent-tool-optimization
**Date**: 2026-01-02

## Overview

This feature introduces optimized response types for the agent semantic search tool. The key change is replacing `interpretation` and `lyrics` with `short_description` in search results while preserving full data access via the batch metadata tool.

---

## Type Changes

### New Type: OptimizedIndexedTrackResult

A lightweight version of `IndexedTrackResult` for semantic search results.

```typescript
/**
 * Optimized track result for agent semantic search
 *
 * Contains short_description instead of full interpretation/lyrics
 * to reduce token usage. Use batchMetadata for full details.
 */
interface OptimizedIndexedTrackResult {
  isrc: string;                    // ISO 3901 ISRC (12 alphanumeric)
  title: string;                   // Track title
  artist: string;                  // Artist name
  album: string;                   // Album name
  artworkUrl?: string;             // Album cover URL
  duration?: number;               // Track duration in seconds
  inLibrary: boolean;              // Is track in user's library?
  isIndexed: true;                 // Always true (from vector index)
  score: number;                   // Relevance score (0-1)

  // Optimized: short_description instead of interpretation/lyrics
  shortDescription: string | null; // Max 500 chars (from feature 012)

  // Audio features retained (small payload)
  audioFeatures?: AudioFeatures;
}
```

### Unchanged: IndexedTrackResult

The full `IndexedTrackResult` type remains unchanged and is returned by `batchMetadata`:

```typescript
/**
 * Full track result from vector index (unchanged)
 *
 * Returned by batchMetadata for detailed track information.
 */
interface IndexedTrackResult {
  isrc: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  duration?: number;
  inLibrary: boolean;
  isIndexed: true;
  score: number;

  // Full content (for batchMetadata)
  lyrics?: string;
  interpretation?: string;
  shortDescription?: string;       // NEW: also include in full results

  audioFeatures?: AudioFeatures;
}
```

---

## Output Type Changes

### SemanticSearchOutput (Modified)

```typescript
/**
 * Semantic Search Tool Output (optimized)
 */
interface SemanticSearchOutput {
  tracks: OptimizedIndexedTrackResult[];  // Changed: was IndexedTrackResult[]
  query: string;
  totalFound: number;
  summary: string;
  durationMs: number;
}
```

### BatchMetadataOutput (Enhanced)

```typescript
/**
 * Batch Metadata Tool Output (ensure full data)
 */
interface BatchMetadataOutput {
  tracks: IndexedTrackResult[];  // Unchanged: returns full data including interpretation/lyrics
  found: string[];
  notFound: string[];
  summary: string;
  durationMs: number;
}
```

---

## Qdrant Payload Fields

### Agent Search Fields (Optimized)

Fields requested in `hybridSearchOptimized()`:

| Field | Type | Notes |
|-------|------|-------|
| isrc | string | Primary identifier |
| title | string | Track title |
| artist | string | Artist name |
| album | string | Album name |
| short_description | string \| null | AI-generated summary (max 500 chars) |
| acousticness | number \| null | Audio feature |
| danceability | number \| null | Audio feature |
| energy | number \| null | Audio feature |
| instrumentalness | number \| null | Audio feature |
| key | number \| null | Audio feature |
| liveness | number \| null | Audio feature |
| loudness | number \| null | Audio feature |
| mode | number \| null | Audio feature |
| speechiness | number \| null | Audio feature |
| tempo | number \| null | Audio feature |
| valence | number \| null | Audio feature |

**Excluded fields:**
- `interpretation` - Full AI interpretation text (large)
- `lyrics` - Full lyrics text (large)

### Full Payload Fields (Batch Metadata)

All fields including `interpretation` and `lyrics` (unchanged from current implementation).

---

## Validation Rules

### OptimizedIndexedTrackResult

- `isrc`: 12 alphanumeric characters (ISO 3901)
- `title`, `artist`, `album`: Non-empty strings
- `score`: Number between 0 and 1
- `shortDescription`: String or null, max 500 characters
- `audioFeatures`: All values 0-1 except key (-1 to 11), loudness (-60 to 0), tempo (0-250)

### Zod Schema

```typescript
const OptimizedIndexedTrackResultSchema = z.object({
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  artworkUrl: z.string().url().optional(),
  duration: z.number().positive().optional(),
  inLibrary: z.boolean(),
  isIndexed: z.literal(true),
  score: z.number().min(0).max(1),
  shortDescription: z.string().max(500).nullable(),
  audioFeatures: AudioFeaturesSchema.optional(),
});
```

---

## Migration Notes

### Breaking Changes

The `SemanticSearchOutput.tracks` type changes from `IndexedTrackResult[]` to `OptimizedIndexedTrackResult[]`. This is intentional to enforce the optimization at the type level.

### Agent Adaptation Required

The chat agent system prompt must be updated to:
1. Understand that semantic search returns `shortDescription` (not `interpretation`/`lyrics`)
2. Use `batchMetadata` when full track details are needed

### Backward Compatibility

- The Discover UI (`discoveryService.ts`) is **unaffected** as it uses the existing `hybridSearch()` method
- The batch metadata tool returns **full data** including `interpretation` and `lyrics`
