# Research: Tidal Playlist Export

**Feature**: 017-tidal-playlist-export
**Date**: 2026-01-04

## Tidal API Playlist Endpoints

### Decision: Use Tidal v2 JSON:API endpoints

**Rationale**: The Tidal v2 API uses JSON:API format consistent with existing TidalService implementation. All required endpoints are available at THIRD_PARTY access tier.

**Endpoints Required**:

1. **POST /v2/playlists** - Create a new playlist
   - Requires: `Authorization_Code_PKCE` with scopes `playlists.write`, `w_usr`
   - Access tier: `THIRD_PARTY`
   - Request body: `PlaylistCreateOperation_Payload`
   - Returns: `Playlists_Single_Resource_Data_Document` with new playlist UUID

2. **POST /v2/playlists/{id}/relationships/items** - Add tracks to playlist
   - Requires: Same auth as create
   - Access tier: `THIRD_PARTY`
   - Max 20 items per request (constraint from schema: `maxItems: 20`)
   - Request body: `PlaylistItemsRelationshipAddOperation_Payload`

3. **GET /v2/tracks** with `filter[isrc]` - Resolve ISRCs to Tidal track IDs
   - Already implemented in TidalService (`batchFetchTracksByIsrc`)
   - Max 20 ISRCs per request

**Alternatives Considered**:

- Tidal v1 API: Deprecated, inconsistent with existing codebase patterns
- Direct track IDs: Would require tracks to already have tidalId, but playlist tracks come from agent suggestions with only ISRCs

## Playlist Create Payload Schema

### Decision: Use `UNLISTED` access type for private playlists

**Rationale**: Spec clarification specifies playlists should be private (only user can see). Tidal API has `PUBLIC` and `UNLISTED` options - `UNLISTED` achieves privacy.

**Schema Structure**:

```json
{
  "data": {
    "type": "playlists",
    "attributes": {
      "name": "string", // Required, max 150 chars
      "description": "string", // Optional
      "accessType": "UNLISTED" // For private playlist
    }
  }
}
```

## Track Addition Payload Schema

### Decision: Batch tracks in chunks of 20

**Rationale**: Tidal API enforces `maxItems: 20` constraint. For playlists up to 50 tracks (spec limit), this means max 3 API calls.

**Schema Structure**:

```json
{
  "data": [
    {
      "type": "tracks",
      "id": "tidal-track-id",
      "meta": {
        "addedAt": "2026-01-04T12:00:00Z" // Required ISO 8601 datetime
      }
    }
  ],
  "meta": {
    "positionBefore": "string" // Optional, for ordering
  }
}
```

## Authentication Flow

### Decision: Use user's OAuth token from Clerk metadata

**Rationale**: Feature 016 stores user's Tidal OAuth tokens in Clerk private metadata with `playlists.write` scope. We retrieve these tokens via `getTidalTokens(userId)` and use them for API calls.

**Flow**:

1. Frontend calls `POST /api/playlists/export` with playlist data
2. Backend extracts userId from Clerk session
3. Backend retrieves user's Tidal tokens from `getTidalTokens(userId)`
4. If token expired, attempt refresh via existing `refreshTidalTokens()`
5. Use access token for Tidal API Authorization header

**Alternatives Considered**:

- Client credentials: Not user-specific, can't access user's playlists
- Frontend direct API calls: Would expose tokens, violates security principles

## ISRC to Track ID Resolution

### Decision: Reuse existing `batchFetchTracksByIsrc` method

**Rationale**: TidalService already has a method that resolves ISRCs to Tidal track IDs in batches of 20. This handles the lookup efficiently and respects rate limits.

**Flow**:

1. Extract ISRCs from playlist suggestion tracks
2. Call `batchFetchTracksByIsrc(isrcs, countryCode)`
3. Map ISRC -> tidalId for each found track
4. Skip tracks not found on Tidal (log and report to user)

## Error Handling Strategy

### Decision: Fail fast with clear user feedback

**Rationale**: Per spec, users should receive actionable error messages (SC-007).

**Error Categories**:

1. **No Tidal connection**: Return 401 with `no_tidal_connection` code
2. **Token expired + refresh failed**: Return 401 with `token_refresh_failed` code
3. **No tracks found**: Return 422 with `no_tracks_available` code
4. **Tidal API errors (429, 5xx)**: Return 503 with retry-after hint
5. **Partial success**: Return 200 with `tracksSkipped` count

## Rate Limiting

### Decision: Use existing RateLimiter infrastructure

**Rationale**: TidalService already has a rate limiter (`this.rateLimiter`) configured for 2 req/s, max 3 concurrent. Playlist creation will use the same limiter.

**API Calls per Export** (worst case, 50 tracks):

1. ISRC resolution: 3 calls (50 ISRCs / 20 per batch)
2. Create playlist: 1 call
3. Add tracks: 3 calls (50 tracks / 20 per batch)
   Total: 7 API calls

At 2 req/s, this completes in ~4 seconds, well under the 10-second SLA.

## Frontend Modal Component

### Decision: Use native HTML dialog with React state

**Rationale**: Consistent with existing app patterns, no external modal library needed. Accessible via native dialog semantics.

**Behavior**:

- Opens on "Save to Tidal" button click
- Pre-filled name input with playlist title
- Client-side validation (non-empty, max 150 chars)
- Disabled save button during API call
- Close on Escape key (native dialog behavior)
- Reset state on cancel

**Alternatives Considered**:

- Headless UI Dialog: Adds dependency, overkill for single modal
- React Portal: Native dialog already handles z-index correctly
