# API Contract: Playlist Export

**Feature**: 017-tidal-playlist-export
**Date**: 2026-01-04

## POST /api/playlists/export

Export an AI-generated playlist to the user's Tidal account.

### Authentication

- Requires Clerk session (via `requireAuth` middleware)
- Requires approved user (via `requireApproved` middleware)
- User must have connected Tidal account (checked at runtime)

### Request

**Content-Type**: `application/json`

**Body**:
```typescript
{
  name: string;         // 1-150 characters, required
  tracks: Array<{
    isrc: string;       // 12 alphanumeric chars
    title: string;      // For error display
    artist: string;     // For error display
  }>;                   // 1-50 items
}
```

**Example**:
```json
{
  "name": "Chill Vibes",
  "tracks": [
    {
      "isrc": "USUM71900765",
      "title": "Blinding Lights",
      "artist": "The Weeknd"
    },
    {
      "isrc": "USUG11902288",
      "title": "Don't Start Now",
      "artist": "Dua Lipa"
    }
  ]
}
```

### Success Response (200 OK)

```typescript
{
  success: true;
  playlistId: string;           // Tidal playlist UUID
  playlistName: string;         // Name as created
  tracksAdded: number;          // Count of tracks added
  tracksSkipped: number;        // Count of tracks not found
  skippedTracks?: Array<{       // Present if any skipped
    isrc: string;
    title: string;
    artist: string;
  }>;
}
```

**Example**:
```json
{
  "success": true,
  "playlistId": "550e8400-e29b-41d4-a716-446655440000",
  "playlistName": "Chill Vibes",
  "tracksAdded": 10,
  "tracksSkipped": 2,
  "skippedTracks": [
    {
      "isrc": "USRC00000001",
      "title": "Unavailable Track",
      "artist": "Unknown Artist"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request body",
    "details": [
      {
        "path": ["name"],
        "message": "String must be at least 1 character"
      }
    ]
  }
}
```

#### 401 Unauthorized - No Tidal Connection

```json
{
  "error": {
    "code": "no_tidal_connection",
    "message": "Tidal account not connected. Please connect your Tidal account to save playlists.",
    "retryable": false
  }
}
```

#### 401 Unauthorized - Token Refresh Failed

```json
{
  "error": {
    "code": "token_refresh_failed",
    "message": "Your Tidal session has expired. Please reconnect your Tidal account.",
    "retryable": false
  }
}
```

#### 422 Unprocessable Entity - No Tracks Found

```json
{
  "error": {
    "code": "no_tracks_available",
    "message": "None of the tracks in this playlist could be found on Tidal.",
    "retryable": false
  }
}
```

#### 429 Too Many Requests - Rate Limited

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Tidal API rate limit reached. Please try again in a few seconds.",
    "retryable": true,
    "retryAfter": 5
  }
}
```

#### 503 Service Unavailable - Tidal API Down

```json
{
  "error": {
    "code": "tidal_unavailable",
    "message": "Tidal is temporarily unavailable. Please try again later.",
    "retryable": true
  }
}
```

## Zod Schemas

```typescript
// Request schema
export const PlaylistExportRequestSchema = z.object({
  name: z.string().min(1).max(150).trim(),
  tracks: z.array(z.object({
    isrc: z.string().regex(/^[A-Z0-9]{12}$/i, 'Invalid ISRC format'),
    title: z.string().min(1),
    artist: z.string().min(1),
  })).min(1).max(50),
});

// Response schema
export const PlaylistExportResponseSchema = z.object({
  success: z.literal(true),
  playlistId: z.string().uuid(),
  playlistName: z.string(),
  tracksAdded: z.number().int().nonnegative(),
  tracksSkipped: z.number().int().nonnegative(),
  skippedTracks: z.array(z.object({
    isrc: z.string(),
    title: z.string(),
    artist: z.string(),
  })).optional(),
});

// Error schema
export const PlaylistExportErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'validation_error',
      'no_tidal_connection',
      'token_refresh_failed',
      'no_tracks_available',
      'playlist_creation_failed',
      'rate_limit_exceeded',
      'tidal_unavailable',
    ]),
    message: z.string(),
    retryable: z.boolean(),
    details: z.array(z.any()).optional(),
    retryAfter: z.number().optional(),
  }),
});
```

## Frontend Integration

### Hook Usage

```typescript
import { usePlaylistExport } from '@/hooks/usePlaylistExport';

function PlaylistCard({ title, tracks }) {
  const { exportPlaylist, isExporting, error } = usePlaylistExport();

  const handleSave = async (customName: string) => {
    const result = await exportPlaylist({
      name: customName,
      tracks: tracks.map(t => ({
        isrc: t.isrc,
        title: t.title,
        artist: t.artist,
      })),
    });

    if (result.success) {
      showToast(`Saved '${result.playlistName}' with ${result.tracksAdded} tracks`);
    }
  };

  // ...
}
```

### Error Handling

```typescript
switch (error?.code) {
  case 'no_tidal_connection':
    redirectToTidalConnect();
    break;
  case 'token_refresh_failed':
    showReconnectPrompt();
    break;
  case 'rate_limit_exceeded':
  case 'tidal_unavailable':
    showRetryButton();
    break;
  default:
    showErrorMessage(error?.message);
}
```
