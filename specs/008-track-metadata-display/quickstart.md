# Quickstart: Track Metadata Display

**Feature**: 008-track-metadata-display
**Date**: 2025-12-30

## Overview

This guide explains how to run, test, and validate the track metadata display feature.

## Prerequisites

### Services Required

1. **PostgreSQL** - Library data storage
2. **Qdrant** - Vector search index with indexed tracks
3. **Backend** - GraphQL API server
4. **Frontend** - React application

### Start All Services

```bash
# Start infrastructure (PostgreSQL, Qdrant)
docker compose up db qdrant -d

# Start backend (in separate terminal)
cd backend
npm run dev

# Start frontend (in separate terminal)
cd frontend
npm run dev
```

### Verify Services

```bash
# Check Qdrant is running
curl http://localhost:6333/collections

# Check backend GraphQL
curl http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'

# Frontend available at
open http://localhost:5173
```

## Testing the Feature

### 1. Ensure Test Data Exists

You need tracks in both:
- **Library** (PostgreSQL): Added via library management feature
- **Vector Index** (Qdrant): Processed by ingestion pipeline

If you don't have indexed tracks, follow these steps:

```bash
# Add a track to library (via frontend or GraphQL mutation)
# The ingestion pipeline will automatically process it

# Check ingestion status in Inngest dashboard
open http://localhost:8288

# Verify track exists in Qdrant
curl http://localhost:6333/collections/tracks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

### 2. Test Indexed Status Display

1. Navigate to Library → Tracks view
2. Tracks with extended metadata show an indexed indicator (badge/icon)
3. Tracks without metadata show no indicator

**GraphQL Query to Verify**:

```graphql
query {
  getLibraryTracks {
    id
    title
    artistName
    isIndexed
  }
}
```

### 3. Test Accordion Expansion

1. Click on an indexed track row
2. Accordion panel expands below with:
   - Skeleton loader during fetch
   - Lyrics section (or "No lyrics available" for instrumentals)
   - Interpretation section (or "No interpretation available")
   - Audio features with formatted values
3. Click the same row again to collapse
4. Click a different row to collapse current and expand new

### 4. Test Error Handling

**Simulate Qdrant unavailable**:

```bash
# Stop Qdrant
docker compose stop qdrant

# Reload library page
# - Indexed badges should not appear (fail-open)
# - Expanding a track shows error with retry button

# Restart Qdrant
docker compose up qdrant -d

# Click retry - should load successfully
```

## Manual Testing Checklist

### P1 - View Indexed Track Details

- [ ] Accordion expands on track row click
- [ ] Loading skeleton shown during fetch
- [ ] Lyrics displayed when available
- [ ] Interpretation displayed when available
- [ ] Only one accordion open at a time
- [ ] Click same row collapses accordion

### P1 - Graceful Missing Data

- [ ] Instrumental tracks show "No lyrics available"
- [ ] Missing interpretation shows appropriate message
- [ ] Non-indexed tracks show "Not yet available"

### P2 - Audio Features

- [ ] Audio features section displayed
- [ ] Values formatted correctly (percentages, BPM, key names)
- [ ] Missing features show placeholder or hidden

### P3 - Visual Indicator

- [ ] Indexed tracks show badge in Tracks view
- [ ] Indexed tracks show badge in album track listing
- [ ] Non-indexed tracks show no badge

### Error States

- [ ] Network error shows retry button
- [ ] Retry button works after error

## GraphQL Queries Reference

### Check Indexed Status

```graphql
query GetLibraryTracksWithStatus {
  getLibraryTracks {
    id
    title
    artistName
    metadata {
      isrc
    }
    isIndexed
  }
}
```

### Get Extended Metadata

```graphql
query GetExtendedMetadata($isrc: String!) {
  getExtendedTrackMetadata(isrc: $isrc) {
    isrc
    lyrics
    interpretation
    audioFeatures {
      tempo
      energy
      valence
      danceability
      acousticness
      instrumentalness
      key
      mode
      liveness
      loudness
      speechiness
    }
  }
}
```

**Example Variables**:
```json
{
  "isrc": "USRC12345678"
}
```

## Development Workflow

### Backend Changes

```bash
cd backend

# Run tests
npm test

# Type check
npm run type-check

# Start dev server with hot reload
npm run dev
```

### Frontend Changes

```bash
cd frontend

# Run tests
npm test

# Type check
npm run type-check

# Start dev server with hot reload
npm run dev
```

### GraphQL Schema Updates

1. Edit `backend/src/schema/trackMetadata.graphql`
2. Restart backend server
3. Run `npm run codegen` in frontend (if using typed GraphQL)

## Troubleshooting

### "Track not indexed" when it should be

1. Check ISRC exists in library track metadata:
   ```graphql
   query {
     getLibraryTrack(id: "...") {
       metadata { isrc }
     }
   }
   ```

2. Check track exists in Qdrant:
   ```bash
   # Convert ISRC to UUID (see backend/src/utils/isrcHash.ts)
   # Then query Qdrant directly
   curl http://localhost:6333/collections/tracks/points/...
   ```

3. Check ingestion status in Inngest dashboard

### Accordion won't expand

1. Check browser console for errors
2. Verify `isIndexed` is true for the track
3. Check GraphQL network requests in dev tools

### Audio features not showing

1. Not all tracks have audio features from ReccoBeats
2. Check raw response from `getExtendedTrackMetadata`
3. Verify ReccoBeats API was called during ingestion

## Related Documentation

- [Feature Spec](./spec.md)
- [Implementation Plan](./plan.md)
- [Data Model](./data-model.md)
- [GraphQL Contract](./contracts/track-metadata.graphql)
- [Track Ingestion Pipeline](../006-track-ingestion-pipeline/spec.md)
- [Library Management](../002-library-management/spec.md)
