# Data Model: Track Metadata Display

**Feature**: 008-track-metadata-display
**Date**: 2025-12-30

## Overview

This feature extends the existing data model to surface extended track metadata from the Qdrant vector index. No new database entities are created—the feature reads from existing sources and adds computed/derived fields to GraphQL types.

## Data Sources

### 1. PostgreSQL (Existing - Read Only)

#### LibraryTrack Entity
**Location**: `backend/src/entities/LibraryTrack.ts`

```typescript
interface LibraryTrack {
  id: string;              // UUID primary key
  tidalTrackId: string;    // Tidal track identifier
  title: string;
  artistName: string;
  albumName: string | null;
  duration: number;        // seconds
  coverArtUrl: string | null;
  metadata: {
    isrc?: string;         // ISO 3901 identifier (12 chars)
    explicitContent?: boolean;
    popularity?: number;
    genres?: string[];
  };
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relevant Fields for This Feature**:
- `metadata.isrc` - Used to query Qdrant for extended metadata

#### LibraryAlbum Entity (TrackInfo)
**Location**: `backend/src/entities/LibraryAlbum.ts`

```typescript
interface TrackInfo {
  trackNumber: number;
  title: string;
  duration: number;
  isrc?: string;           // ISO 3901 identifier
}
```

**Relevant Fields for This Feature**:
- `isrc` - Used to query Qdrant for indexed status and extended metadata

---

### 2. Qdrant Vector Index (Existing - Read Only)

#### TrackDocument Payload
**Location**: `services/search-index/src/schema/trackDocument.ts`

```typescript
interface TrackPayload {
  // Core metadata
  isrc: string;            // 12 alphanumeric chars
  title: string;
  artist: string;
  album: string;

  // Text content (nullable for instrumentals)
  lyrics: string | null;
  interpretation: string | null;

  // Audio features (nullable if unavailable)
  acousticness: number | null;     // 0.0-1.0
  danceability: number | null;     // 0.0-1.0
  energy: number | null;           // 0.0-1.0
  instrumentalness: number | null; // 0.0-1.0
  key: number | null;              // -1 to 11 (pitch class)
  liveness: number | null;         // 0.0-1.0
  loudness: number | null;         // -60 to 0 dB
  mode: 0 | 1 | null;              // 0=minor, 1=major
  speechiness: number | null;      // 0.0-1.0
  tempo: number | null;            // 0-250 BPM
  valence: number | null;          // 0.0-1.0
}
```

---

## New GraphQL Types

### ExtendedTrackMetadata

Represents the full extended metadata for a single track, retrieved from Qdrant.

```typescript
interface ExtendedTrackMetadata {
  isrc: string;                    // Track identifier
  lyrics: string | null;           // Plain text lyrics
  interpretation: string | null;   // LLM-generated theme summary
  audioFeatures: AudioFeatures | null; // Structured audio analysis
}
```

**Field Descriptions**:
- `isrc`: The ISRC used to identify this track in the index
- `lyrics`: Full lyrics text, null for instrumentals
- `interpretation`: Natural language description of themes/mood
- `audioFeatures`: Structured object with all 11 audio properties

### AudioFeatures

Structured representation of audio analysis data.

```typescript
interface AudioFeatures {
  acousticness: number | null;     // 0.0-1.0: acoustic vs electronic
  danceability: number | null;     // 0.0-1.0: rhythm suitability
  energy: number | null;           // 0.0-1.0: intensity
  instrumentalness: number | null; // 0.0-1.0: likelihood of no vocals
  key: number | null;              // -1 to 11: pitch class
  liveness: number | null;         // 0.0-1.0: live audience presence
  loudness: number | null;         // -60 to 0: average dB
  mode: number | null;             // 0=minor, 1=major
  speechiness: number | null;      // 0.0-1.0: spoken word presence
  tempo: number | null;            // 0-250: beats per minute
  valence: number | null;          // 0.0-1.0: musical positivity
}
```

---

## Extended Existing Types

### LibraryTrack Extension

Add computed field for indexed status:

```typescript
interface LibraryTrackExtended extends LibraryTrack {
  isIndexed: boolean;  // Computed from Qdrant existence check
}
```

**Resolution Logic**:
1. Extract `metadata.isrc` from LibraryTrack
2. If ISRC is null/undefined, return `false`
3. Query Qdrant via DataLoader batch (for efficiency)
4. Return existence check result

### TrackInfo Extension

Add computed field for indexed status in album track listings:

```typescript
interface TrackInfoExtended extends TrackInfo {
  isIndexed: boolean;  // Computed from Qdrant existence check
}
```

**Resolution Logic**:
1. Extract `isrc` from TrackInfo
2. If ISRC is null/undefined, return `false`
3. Query Qdrant via DataLoader batch
4. Return existence check result

---

## Validation Rules

### ISRC Validation
- Must be exactly 12 alphanumeric characters
- Case-insensitive (normalized to uppercase)
- Missing ISRC results in `isIndexed: false`, not an error

### Audio Feature Ranges
| Feature | Min | Max | Unit |
|---------|-----|-----|------|
| acousticness | 0.0 | 1.0 | ratio |
| danceability | 0.0 | 1.0 | ratio |
| energy | 0.0 | 1.0 | ratio |
| instrumentalness | 0.0 | 1.0 | ratio |
| key | -1 | 11 | pitch class |
| liveness | 0.0 | 1.0 | ratio |
| loudness | -60 | 0 | dB |
| mode | 0 | 1 | enum |
| speechiness | 0.0 | 1.0 | ratio |
| tempo | 0 | 250 | BPM |
| valence | 0.0 | 1.0 | ratio |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LibraryPage                                                     │
│    │                                                             │
│    ├─► GET_LIBRARY_TRACKS (with isIndexed field)                │
│    │     └─► Apollo Client cache                                 │
│    │                                                             │
│    └─► TracksView                                                │
│          │                                                       │
│          ├─► TrackRow (shows IndexedBadge if isIndexed=true)    │
│          │                                                       │
│          └─► [onClick] TrackAccordion                            │
│                │                                                 │
│                └─► GET_EXTENDED_TRACK_METADATA(isrc)            │
│                      └─► TrackMetadataPanel                      │
│                            ├─► LyricsSection                     │
│                            ├─► InterpretationSection             │
│                            └─► AudioFeaturesDisplay              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend (GraphQL)                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LibraryTrack.isIndexed (field resolver)                        │
│    └─► DataLoader batch → BackendQdrantClient.checkTracksExist  │
│                                                                  │
│  Query.getExtendedTrackMetadata(isrc)                           │
│    └─► trackMetadataService.getExtendedMetadata(isrc)           │
│          └─► BackendQdrantClient.getTrackPayload(isrc)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Qdrant Vector Index                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Collection: tracks                                              │
│    │                                                             │
│    ├─► retrieve(ids, with_payload=false) → existence check      │
│    │                                                             │
│    └─► retrieve(ids, with_payload=true)  → full payload         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

This feature is read-only and does not modify state. The indexed status is determined by whether the track ingestion pipeline (spec 006) has processed the track.

**Indexed Status Determination**:
```
Track ISRC → Hash to UUID → Check Qdrant existence → Boolean result
```

**States**:
- `isIndexed: false` - Track not in vector index (not yet ingested or no ISRC)
- `isIndexed: true` - Track exists in vector index (ingested)

---

## Error Handling

### Missing ISRC
- `LibraryTrack.metadata.isrc` is nullable
- If null/undefined: `isIndexed` = false, no error

### Qdrant Unavailable
- `checkTracksExist`: Returns empty map (all tracks appear as not indexed)
- `getTrackPayload`: Returns null (UI shows error state)

### Track Not Found
- `getExtendedTrackMetadata`: Returns null (UI shows "not available")

---

## Indexes and Performance

### Qdrant Indexes (Existing)
- Point ID: UUID derived from ISRC hash
- Payload index: `isrc` (keyword) for exact lookup

### Query Patterns
| Operation | Complexity | Batching |
|-----------|------------|----------|
| Check indexed status | O(n) point lookup | Yes (DataLoader) |
| Get extended metadata | O(1) single point | No |

### Expected Latency
- Indexed status batch (500 ISRCs): <100ms
- Extended metadata single: <50ms
