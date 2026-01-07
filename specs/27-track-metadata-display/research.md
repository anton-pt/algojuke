# Research: Track Metadata Display

**Feature**: 008-track-metadata-display
**Date**: 2025-12-30

## Overview

This document captures research findings and technical decisions for implementing the track metadata display feature. No NEEDS CLARIFICATION items were identified—all technical context was resolved from the existing codebase and user input.

## Research Areas

### 1. Indexed Status Query Strategy

**Decision**: Extend existing library queries to include indexed status OR provide a separate batch query

**Rationale**: The user specified flexibility: "The track ingestion statuses may be fetched either by the same GraphQL query that retrieves library tracks or album track listings, or by a separate request which takes a list of ISRCs."

**Chosen Approach**: Add `isIndexed: Boolean` field to existing `LibraryTrack` and `TrackInfo` types with a field resolver that batch-loads indexed status from Qdrant. This allows the frontend to request the field when needed without a separate query.

**Alternatives Considered**:
- Separate `checkIndexedStatus(isrcs: [String!]!)` query → More API calls, cache coordination complexity
- Store indexed status in PostgreSQL → Sync complexity, stale data risk
- Pre-compute on library add → Timing issues if ingestion is async

**Implementation Pattern**:
```graphql
extend type LibraryTrack {
  isIndexed: Boolean!
}

extend type TrackInfo {
  isIndexed: Boolean!
}
```

Field resolvers use DataLoader pattern to batch ISRCs and query Qdrant once per request.

---

### 2. Extended Metadata Retrieval

**Decision**: New GraphQL query `getExtendedTrackMetadata(isrc: String!)` returning full payload from Qdrant

**Rationale**: Extended metadata (lyrics, interpretation, audio features) is fetched on-demand when the accordion expands. This avoids loading large text payloads for all tracks upfront.

**Implementation Pattern**:
```graphql
type ExtendedTrackMetadata {
  isrc: String!
  lyrics: String
  interpretation: String
  audioFeatures: AudioFeatures
}

type AudioFeatures {
  acousticness: Float
  danceability: Float
  energy: Float
  instrumentalness: Float
  key: Int
  liveness: Float
  loudness: Float
  mode: Int
  speechiness: Float
  tempo: Float
  valence: Float
}

type Query {
  getExtendedTrackMetadata(isrc: String!): ExtendedTrackMetadata
}
```

**Alternatives Considered**:
- Embedding metadata in library entities → Large payload, PostgreSQL sync issues
- REST endpoint → Inconsistent with existing GraphQL architecture

---

### 3. Qdrant Payload Retrieval

**Decision**: Extend `BackendQdrantClient` with `getTrackPayload(isrc: string)` method

**Rationale**: The existing client only checks existence. We need to retrieve the full payload (excluding vector) for display.

**Implementation Pattern**:
```typescript
async getTrackPayload(isrc: string): Promise<TrackPayload | null> {
  const uuid = hashIsrcToUuid(isrc);
  const points = await this.client.retrieve(this.collection, {
    ids: [uuid],
    with_payload: true,
    with_vector: false,
  });
  return points.length > 0 ? points[0].payload as TrackPayload : null;
}
```

**Error Handling**: Return `null` on Qdrant errors (fail-safe for UI display).

---

### 4. Accordion UI Pattern

**Decision**: Single-expansion accordion integrated into TracksView and AlbumDetailView

**Rationale**: User clarification specified accordion-style UI with single-expansion behavior.

**Implementation Pattern**:
- State: `expandedTrackId: string | null` in parent component
- Click handler: Toggle expansion, cancel pending fetches
- Loading: Skeleton loader in expanded panel
- Error: Inline error with retry button

**Component Structure**:
```
TrackRow (existing) → enhanced with onClick, isIndexed badge
  └── TrackAccordion (new) → conditional render when expanded
       └── TrackMetadataPanel → loading/error/content states
            ├── LyricsSection
            ├── InterpretationSection
            └── AudioFeaturesDisplay
```

---

### 5. Audio Feature Formatting

**Decision**: Human-readable display with consistent units and labels

**Rationale**: FR-020 requires formatting for readability.

**Formatting Rules**:
| Feature | Format | Example |
|---------|--------|---------|
| acousticness | Percentage | "73%" |
| danceability | Percentage | "85%" |
| energy | Percentage | "92%" |
| instrumentalness | Percentage | "2%" |
| key | Musical notation | "C major", "A minor" |
| liveness | Percentage | "15%" |
| loudness | Decibels | "-5.2 dB" |
| mode | Text | "Major" / "Minor" |
| speechiness | Percentage | "8%" |
| tempo | BPM | "128 BPM" |
| valence | Descriptive | "Uplifting" / "Melancholic" / "Neutral" |

**Key Mapping** (pitch class → note):
```typescript
const KEY_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
const keyName = key >= 0 ? `${KEY_NAMES[key]} ${mode === 1 ? 'major' : 'minor'}` : 'Unknown';
```

---

### 6. Caching Strategy

**Decision**: Apollo Client cache handles response caching; no additional caching layer

**Rationale**: User specified caching is optional. Apollo Client's normalized cache automatically caches query results by default. The `getExtendedTrackMetadata` query can be cached by ISRC.

**Cache Policy**:
- `isIndexed` field: Cache with library data (refetched on page load)
- Extended metadata: Cache indefinitely (immutable after ingestion)

---

### 7. Error Handling

**Decision**: Fail-safe UI with inline error messages and retry

**Rationale**: Constitution requires graceful degradation; spec requires error messages with retry.

**Error States**:
1. **Qdrant unavailable for indexed status**: Show all tracks without indexed badges (fail-open)
2. **Qdrant unavailable for metadata fetch**: Show error in accordion panel with "Retry" button
3. **Track not found in index**: Show "Metadata not available" message
4. **Network error**: Show generic error with retry

---

## Dependencies Confirmed

| Dependency | Version | Usage |
|------------|---------|-------|
| @qdrant/js-client-rest | existing | Payload retrieval from vector index |
| Apollo Client | 3.x | GraphQL queries with caching |
| Apollo Server | 4.x | GraphQL resolvers |
| DataLoader | TBD | Batch loading indexed status |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Qdrant latency spikes | Slow accordion load | Timeout with user-friendly error |
| Large lyrics payload | Slow render | Scrollable container, lazy rendering |
| ISRC missing from library track | Cannot query index | Graceful "not indexed" state |

---

## Conclusion

All technical decisions are resolved. The implementation follows existing patterns in the codebase with minimal new complexity. Proceed to Phase 1 (data model and contracts).
