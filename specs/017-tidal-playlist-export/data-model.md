# Data Model: Tidal Playlist Export

**Feature**: 017-tidal-playlist-export
**Date**: 2026-01-04

## Overview

This feature does not introduce new persistent entities. All data flows through request/response payloads:
- Frontend sends export request with playlist data
- Backend transforms to Tidal API format
- Backend returns result with success/error details

## Request/Response Schemas

### PlaylistExportRequest

**Description**: Request to export a playlist to Tidal

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | 1-150 chars, trimmed | Playlist name (from modal, may differ from AI-generated title) |
| `tracks` | TrackForExport[] | Yes | 1-50 items | Tracks to add to playlist |

### TrackForExport

**Description**: Track data needed for export (subset of PlaylistTrack from feature 015)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isrc` | string | Yes | ISO 3901 ISRC, 12 alphanumeric characters |
| `title` | string | Yes | Track title (for user feedback if not found) |
| `artist` | string | Yes | Artist name (for user feedback if not found) |

### PlaylistExportResponse

**Description**: Result of playlist export operation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Whether playlist was created |
| `playlistId` | string | If success | Tidal playlist UUID |
| `playlistName` | string | If success | Playlist name as created |
| `tracksAdded` | number | If success | Count of tracks successfully added |
| `tracksSkipped` | number | If success | Count of tracks not found on Tidal |
| `skippedTracks` | SkippedTrack[] | If any skipped | Details of skipped tracks |
| `error` | ExportError | If !success | Error details |

### SkippedTrack

**Description**: Track that couldn't be added (not found on Tidal)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isrc` | string | Yes | ISRC that wasn't found |
| `title` | string | Yes | Track title for display |
| `artist` | string | Yes | Artist name for display |

### ExportError

**Description**: Error details for failed export

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Error code (see below) |
| `message` | string | Yes | Human-readable message |
| `retryable` | boolean | Yes | Whether retry may succeed |

**Error Codes**:
- `no_tidal_connection` - User hasn't connected Tidal account
- `token_refresh_failed` - Tidal token expired and refresh failed
- `no_tracks_available` - None of the ISRCs were found on Tidal
- `playlist_creation_failed` - Tidal API rejected playlist creation
- `rate_limit_exceeded` - Tidal API rate limit hit (retryable)
- `tidal_unavailable` - Tidal API is down (retryable)

## Tidal API Payloads

### TidalPlaylistCreatePayload

**Description**: Payload for POST /v2/playlists

```typescript
interface TidalPlaylistCreatePayload {
  data: {
    type: 'playlists';
    attributes: {
      name: string;
      accessType: 'UNLISTED';  // Private playlist
      description?: string;
    };
  };
}
```

### TidalPlaylistCreateResponse

**Description**: Response from POST /v2/playlists

```typescript
interface TidalPlaylistCreateResponse {
  data: {
    id: string;  // UUID of created playlist
    type: 'playlists';
    attributes: {
      name: string;
      createdAt: string;  // ISO 8601
      // ... other fields
    };
  };
}
```

### TidalPlaylistItemsPayload

**Description**: Payload for POST /v2/playlists/{id}/relationships/items

```typescript
interface TidalPlaylistItemsPayload {
  data: Array<{
    type: 'tracks';
    id: string;  // Tidal track ID
    meta: {
      addedAt: string;  // ISO 8601 datetime
    };
  }>;
}
```

## State Transitions

### Export Operation States

```text
IDLE → RESOLVING_TRACKS → CREATING_PLAYLIST → ADDING_TRACKS → SUCCESS
                ↓                 ↓                  ↓
            NO_TRACKS         API_ERROR          PARTIAL_SUCCESS
                ↓                 ↓                  ↓
              ERROR            ERROR              SUCCESS (with warnings)
```

**State Descriptions**:
- `IDLE`: No export in progress
- `RESOLVING_TRACKS`: Looking up ISRCs to get Tidal track IDs
- `CREATING_PLAYLIST`: Calling Tidal API to create empty playlist
- `ADDING_TRACKS`: Adding resolved tracks to playlist (may be multiple batches)
- `SUCCESS`: Playlist created with all/some tracks
- `PARTIAL_SUCCESS`: Playlist created but some tracks couldn't be found
- `ERROR`: Operation failed, playlist not created

## Validation Rules

### Name Validation
- Must not be empty after trimming whitespace
- Maximum 150 characters (Tidal limit)
- If over 150 chars, truncate and warn user before submission

### ISRC Validation
- Must be exactly 12 alphanumeric characters
- Case-insensitive (normalized to uppercase for API calls)
- Invalid ISRCs are skipped with warning in logs

### Track Count Validation
- Minimum 1 track required
- Maximum 50 tracks per export (spec limit FR-005)
- If 0 tracks after ISRC resolution, fail with `no_tracks_available`
