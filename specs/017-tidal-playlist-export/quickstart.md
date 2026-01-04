# Quickstart: Tidal Playlist Export

**Feature**: 017-tidal-playlist-export
**Date**: 2026-01-04

## Prerequisites

1. **Tidal Developer Account**: App registered with THIRD_PARTY access tier
2. **Clerk Integration**: Feature 016 (Clerk + Tidal OAuth) implemented
3. **Playlist Suggestion Tool**: Feature 015 (PlaylistCard component) implemented
4. **Environment Variables**: Existing Tidal credentials configured

## Backend Setup

### 1. Add Playlist Export Schemas

Create `backend/src/schemas/playlist.ts`:

```typescript
import { z } from 'zod';

export const PlaylistExportRequestSchema = z.object({
  name: z.string().min(1).max(150).trim(),
  tracks: z.array(z.object({
    isrc: z.string().regex(/^[A-Z0-9]{12}$/i),
    title: z.string().min(1),
    artist: z.string().min(1),
  })).min(1).max(50),
});

export type PlaylistExportRequest = z.infer<typeof PlaylistExportRequestSchema>;
```

### 2. Extend TidalService

Add to `backend/src/services/tidalService.ts`:

```typescript
/**
 * Create a private playlist in user's Tidal account
 *
 * @param name - Playlist name (max 150 chars)
 * @param accessToken - User's Tidal OAuth access token
 * @returns Playlist UUID
 */
async createPlaylist(
  name: string,
  accessToken: string,
  countryCode: string = 'US'
): Promise<string> {
  // Implementation using POST /v2/playlists
}

/**
 * Add tracks to a playlist by Tidal track IDs
 *
 * @param playlistId - Tidal playlist UUID
 * @param trackIds - Array of Tidal track IDs (max 20 per call)
 * @param accessToken - User's Tidal OAuth access token
 */
async addTracksToPlaylist(
  playlistId: string,
  trackIds: string[],
  accessToken: string,
  countryCode: string = 'US'
): Promise<void> {
  // Implementation using POST /v2/playlists/{id}/relationships/items
  // Chunks into batches of 20
}
```

### 3. Create Playlist Routes

Create `backend/src/routes/playlists.ts`:

```typescript
import { Router } from 'express';
import { requireAuth, requireApproved } from '../middleware/clerkAuth.js';

export function createPlaylistRoutes(tidalService: TidalService): Router {
  const router = Router();

  router.post('/export', requireAuth, requireApproved, async (req, res) => {
    // 1. Validate request body
    // 2. Get user's Tidal tokens
    // 3. Resolve ISRCs to Tidal track IDs
    // 4. Create playlist
    // 5. Add tracks in batches
    // 6. Return result
  });

  return router;
}
```

### 4. Register Routes

In `backend/src/app.ts`:

```typescript
import { createPlaylistRoutes } from './routes/playlists.js';

// After auth routes
app.use('/api/playlists', createPlaylistRoutes(tidalService));
```

## Frontend Setup

### 1. Create Save Modal Component

Create `frontend/src/components/chat/SavePlaylistModal.tsx`:

```typescript
interface SavePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  defaultName: string;
  isLoading: boolean;
}

export function SavePlaylistModal({
  isOpen,
  onClose,
  onSave,
  defaultName,
  isLoading,
}: SavePlaylistModalProps) {
  const [name, setName] = useState(defaultName);

  // Reset name when modal opens
  useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  // Handle save
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await onSave(name.trim());
    }
  };

  return (
    <dialog open={isOpen}>
      <form onSubmit={handleSubmit}>
        <h2>Save to Tidal</h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={150}
          required
        />
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </form>
    </dialog>
  );
}
```

### 2. Create Export Hook

Create `frontend/src/hooks/usePlaylistExport.ts`:

```typescript
export function usePlaylistExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<ExportError | null>(null);

  const exportPlaylist = async (request: PlaylistExportRequest) => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      return data;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPlaylist, isExporting, error };
}
```

### 3. Update PlaylistCard

In `frontend/src/components/chat/PlaylistCard.tsx`:

```typescript
import { SavePlaylistModal } from './SavePlaylistModal';
import { usePlaylistExport } from '@/hooks/usePlaylistExport';

export function PlaylistCard({ title, tracks }: PlaylistCardProps) {
  const [showModal, setShowModal] = useState(false);
  const { exportPlaylist, isExporting, error } = usePlaylistExport();
  const { hasTidalConnection } = useAuth(); // From Clerk context

  const handleSave = async (name: string) => {
    const result = await exportPlaylist({
      name,
      tracks: tracks.map(t => ({
        isrc: t.isrc,
        title: t.title,
        artist: t.artist,
      })),
    });

    if (result.success) {
      setShowModal(false);
      // Show success toast
    }
  };

  return (
    <div className="playlist-card">
      {/* Existing header and tracks */}

      <button
        className="playlist-card__save-button"
        onClick={() => setShowModal(true)}
        disabled={!hasTidalConnection}
        title={!hasTidalConnection ? 'Connect Tidal to save playlists' : ''}
      >
        Save to Tidal
      </button>

      <SavePlaylistModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        defaultName={title}
        isLoading={isExporting}
      />
    </div>
  );
}
```

## Testing

### Run Contract Tests

```bash
cd backend
npm test -- tests/contract/playlistExport.test.ts
```

### Run Integration Tests

Requires Tidal API access and test user tokens:

```bash
cd backend
npm test -- tests/integration/tidalPlaylist.test.ts
```

### Manual Testing

1. Start the app: `npm run dev`
2. Sign in with an approved account
3. Connect Tidal account
4. Ask agent to suggest a playlist
5. Click "Save to Tidal" on the playlist card
6. Edit name if desired, click Save
7. Verify playlist appears in Tidal app

## Troubleshooting

### "Tidal account not connected"
- Ensure user has completed Tidal OAuth flow (feature 016)
- Check Clerk dashboard for user's private metadata

### "Token refresh failed"
- User's Tidal session may have been revoked
- Re-authenticate via Tidal connection flow

### "None of the tracks could be found"
- ISRCs may not match Tidal's catalog
- Check track availability by region (try different countryCode)

### Rate limit errors
- Wait a few seconds and retry
- Check rate limiter configuration in TidalService
