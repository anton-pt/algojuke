# Research: Tidal Library Synchronisation Flow

**Feature**: ALG-32
**Date**: 2026-01-09
**Implementation Guidance**: Tidal collection ID equals user ID from `/users/me` endpoint

## Executive Summary

This feature enables users to sync their Tidal library with AlgoJuke. Key architectural decisions:

1. **Server-side diff calculation** - Backend computes what's missing, frontend displays paginated results
2. **Cursor-based pagination** - Use Tidal's native pagination for efficient large library handling
3. **Reuse existing import logic** - Leverage `addAlbumToLibrary`/`addTrackToLibrary` for imports
4. **Progressive import with feedback** - Import items sequentially with real-time progress updates

## Key Decisions

### 1. Tidal API Integration Strategy

**Decision**: Add three new methods to TidalService for user library access using the userCollections API.

**Rationale**:

- Tidal's v2 API uses userCollections endpoints for library access (not favorites)
- Collection ID equals user ID (confirmed via API documentation and user testing)
- Must use user's OAuth token (not app token) for personal library access

**Implementation**:

```typescript
// backend/src/services/tidalService.ts

/**
 * Get current user's Tidal user ID
 * Required to construct userCollections endpoint paths
 */
async getTidalUserId(accessToken: string): Promise<string> {
  const url = `${this.apiBaseUrl}/v2/users/me`;
  const response = await this.rateLimiter.executeWithRetry(async () => {
    return await axios.get(url, {
      headers: {
        accept: "application/vnd.api+json",
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 5000,
    });
  });
  return response.data.data.id;
}

/**
 * Fetch user's saved albums from Tidal library
 */
async getUserAlbums(
  accessToken: string,
  options: { cursor?: string; limit?: number; countryCode?: string }
): Promise<TidalUserLibraryPage<TidalUserAlbum>>

/**
 * Fetch user's saved tracks from Tidal library
 */
async getUserTracks(
  accessToken: string,
  options: { cursor?: string; limit?: number; countryCode?: string }
): Promise<TidalUserLibraryPage<TidalUserTrack>>
```

**Alternatives Considered**:

- **Favorites API**: Rejected - Tidal v2 uses userCollections, not favorites
- **Batch all pages at once**: Rejected - would be slow for large libraries, use pagination instead

---

### 2. Pagination Strategy

**Decision**: Use Tidal's cursor-based pagination, exposing nextCursor to frontend for "Load More" functionality.

**Rationale**:

- Tidal API uses `page[cursor]` parameter (not offset/limit)
- Cursor is provided in `links.meta.nextCursor` or extracted from `links.next`
- Default page size appears to be ~20 items; we'll request 50 for efficiency

**API Response Structure** (from tidal-api-oas.json):

```typescript
interface TidalUserCollectionResponse {
  data: Array<{
    id: string;           // Album/track ID
    type: "albums" | "tracks";
    meta: { addedAt: string };  // ISO-8601 timestamp
  }>;
  included: Array<{
    id: string;
    type: "albums" | "tracks" | "artists" | "artworks";
    attributes: AlbumAttributes | TrackAttributes | ...;
    relationships?: { artists?: { data: { id: string }[] } };
  }>;
  links: {
    self: string;
    next?: string;  // Full URL to next page
    meta?: { nextCursor?: string };  // Just the cursor value
  };
}
```

**Implementation Pattern**:

```typescript
// Extract cursor from response
const nextCursor = response.data.links?.meta?.nextCursor || null;

// Or extract from next URL if meta not present
if (!nextCursor && response.data.links?.next) {
  const url = new URL(response.data.links.next, this.apiBaseUrl);
  nextCursor = url.searchParams.get("page[cursor]");
}
```

---

### 3. Diff Calculation Architecture

**Decision**: Server-side diff calculation - backend fetches Tidal library page, filters against existing LibraryAlbum/LibraryTrack records, returns only missing items.

**Rationale**:

- Keeps diff logic centralized in backend
- Database queries are efficient with indexed tidalAlbumId/tidalTrackId columns
- Frontend only receives items it needs to display
- Reduces data transfer for users with mostly-synced libraries

**Implementation**:

```typescript
// backend/src/services/tidalLibrarySyncService.ts

async getAlbumDiff(
  userId: string,
  options: { cursor?: string; limit?: number }
): Promise<{
  items: TidalSyncAlbum[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const accessToken = await this.getValidAccessToken(userId);

  // Fetch page from Tidal
  const tidalPage = await this.tidalService.getUserAlbums(accessToken, {
    cursor: options.cursor,
    limit: options.limit || 50,
  });

  // Get existing album IDs for this user (indexed query)
  const existingIds = await this.albumRepository
    .createQueryBuilder("album")
    .select("album.tidalAlbumId")
    .where("album.userId = :userId", { userId })
    .getRawMany()
    .then(rows => new Set(rows.map(r => r.album_tidalAlbumId)));

  // Filter to missing items
  const missing = tidalPage.items.filter(
    album => !existingIds.has(album.id)
  );

  return {
    items: missing.map(this.mapToSyncAlbum),
    nextCursor: tidalPage.nextCursor,
    hasMore: !!tidalPage.nextCursor,
  };
}
```

**Alternatives Considered**:

- **Client-side diff**: Rejected - would require fetching all library data to frontend
- **Full sync then diff**: Rejected - slow for large libraries, unnecessary data transfer
- **Background job for diff**: Rejected - adds complexity, user expects immediate response

---

### 4. Import Batching Strategy

**Decision**: Sequential import with real-time progress feedback via GraphQL mutation response.

**Rationale**:

- Reuse existing `addAlbumToLibrary`/`addTrackToLibrary` which handle metadata enrichment and ingestion scheduling
- Sequential processing respects rate limits and provides clear progress
- Mutation returns detailed results for each item (success/failure/skipped)

**Implementation**:

```typescript
// backend/src/services/tidalLibrarySyncService.ts

async importItems(
  userId: string,
  items: Array<{ type: "album" | "track"; tidalId: string }>
): Promise<TidalImportResult> {
  const results: TidalImportItemResult[] = [];
  let imported = 0, skipped = 0, failed = 0;

  for (const item of items) {
    try {
      if (item.type === "album") {
        await this.libraryService.addAlbumToLibrary(item.tidalId, userId);
      } else {
        await this.libraryService.addTrackToLibrary(item.tidalId, userId);
      }
      imported++;
      results.push({ tidalId: item.tidalId, type: item.type, success: true });
    } catch (error) {
      if (error instanceof DuplicateItemError) {
        skipped++;
        results.push({ tidalId: item.tidalId, type: item.type, success: true });
      } else {
        failed++;
        results.push({
          tidalId: item.tidalId,
          type: item.type,
          success: false,
          error: error instanceof Error ? error.message : "Import failed",
        });
      }
    }
  }

  return { imported, skipped, failed, results };
}
```

**Alternatives Considered**:

- **Parallel import**: Rejected - rate limits make this risky, progress harder to track
- **Background job import**: Rejected - adds complexity, user wants immediate feedback
- **Bulk database insert**: Rejected - need metadata enrichment from Tidal API per item

---

### 5. Error Recovery Strategy

**Decision**: Automatic token refresh with graceful fallback to reconnect prompt.

**Rationale**:

- TidalAuthService already has `attemptTokenRefresh` for server-side refresh
- If refresh fails, return typed error prompting user to reconnect
- Partial import failures are reported, not fatal

**Token Refresh Pattern** (from existing tidalAuthService.ts):

```typescript
// backend/src/services/tidalLibrarySyncService.ts

private async getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getTidalTokens(userId);
  if (!tokens) {
    throw new TidalConnectionError("No Tidal connection", true);
  }

  if (await isTokenExpired(userId)) {
    const refreshed = await attemptTokenRefresh(userId);
    if (!refreshed) {
      throw new TidalConnectionError("Token refresh failed", true);
    }
    // Return refreshed token
    const newTokens = await getTidalTokens(userId);
    return newTokens!.accessToken;
  }

  return tokens.accessToken;
}
```

**GraphQL Error Types**:

```graphql
type TidalConnectionError {
  message: String!
  requiresReconnect: Boolean! # true = show "Reconnect Tidal" button
}

type TidalSyncApiError {
  message: String!
  retryable: Boolean! # true = show "Retry" button
}
```

---

### 6. Frontend Modal Architecture

**Decision**: Tab-based modal with independent album/track state, following SavePlaylistModal patterns.

**Rationale**:

- Consistent with existing modal UX patterns
- Separate tabs allow focused browsing
- Selection state per tab enables independent operations

**Component Structure**:

```typescript
// frontend/src/components/library/TidalSyncModal.tsx

interface TidalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void; // Trigger library refetch
}

interface TidalSyncState {
  activeTab: "albums" | "tracks";
  // Per-tab state
  albums: {
    items: TidalSyncAlbum[];
    selected: Set<string>;
    nextCursor: string | null;
    loading: boolean;
  };
  tracks: {
    items: TidalSyncTrack[];
    selected: Set<string>;
    nextCursor: string | null;
    loading: boolean;
  };
  // Import state
  isImporting: boolean;
  importProgress: { current: number; total: number } | null;
}
```

**Key Interactions**:

1. Modal opens → fetch first page of albums (default tab)
2. Switch tab → fetch first page of tracks (if not already loaded)
3. "Load More" → fetch next page using cursor
4. Checkbox → toggle item in selected Set
5. "Select All" → toggle all visible items
6. "Import Selected" → call mutation with selected items
7. "Import All" → import all items on current tab (paginate through all)

---

## Implementation Patterns

### JSON:API Response Parsing

From existing tidalService.ts (line 90-98, 457-482):

```typescript
// Parse included resources by type
const included = response.data.included || [];

const albumResources = included.filter(
  (r): r is JsonApiResource<TidalAlbumAttributes> => r.type === "albums",
);

const artistResources = included.filter(
  (r): r is JsonApiResource<TidalArtistAttributes> => r.type === "artists",
);

// Build lookup maps for enrichment
const artistMap = new Map<string, string>();
artistResources.forEach((artist) => {
  if (artist.attributes?.name) {
    artistMap.set(artist.id, artist.attributes.name);
  }
});

// Get artist name from album relationships
const getArtistName = (
  album: JsonApiResource<TidalAlbumAttributes>,
): string => {
  const artistRel = album.relationships?.artists?.data;
  if (Array.isArray(artistRel) && artistRel.length > 0) {
    return artistMap.get(artistRel[0].id) || "Unknown Artist";
  }
  return "Unknown Artist";
};
```

### GraphQL Union Type Resolution

From existing playlistResolver.ts (line 262-334):

```typescript
// Resolver for union type
TidalLibraryDiffUnion: {
  __resolveType(obj: { __typename: string }) {
    return obj.__typename;
  },
},

// In query handler - return typed results
try {
  const result = await service.getAlbumDiff(userId, args);
  return { __typename: "TidalLibraryDiffResult", ...result };
} catch (error) {
  if (error instanceof TidalConnectionError) {
    return {
      __typename: "TidalConnectionError",
      message: error.message,
      requiresReconnect: error.requiresReconnect,
    };
  }
  return {
    __typename: "TidalSyncApiError",
    message: "Failed to fetch library",
    retryable: true,
  };
}
```

### Modal Accessibility Pattern

From SavePlaylistModal.tsx (line 45-80):

```typescript
// Focus management
const inputRef = useRef<HTMLInputElement>(null);
const modalRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (isOpen) {
    // Focus first interactive element
    setTimeout(() => inputRef.current?.focus(), 0);
  }
}, [isOpen]);

// Keyboard handling
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === "Escape" && !isLoading) {
    onClose();
  }
}, [isLoading, onClose]);

// Render with ARIA attributes
<div
  ref={modalRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  className="tidal-sync-modal"
>
```

---

## Files to Modify

### Backend - New Files

| File                                              | Purpose                                |
| ------------------------------------------------- | -------------------------------------- |
| `backend/src/services/tidalLibrarySyncService.ts` | Diff calculation, import orchestration |
| `backend/src/schema/tidalSync.graphql`            | GraphQL types and operations           |
| `backend/src/resolvers/tidalSyncResolver.ts`      | Query and mutation handlers            |

### Backend - Modified Files

| File                                   | Changes                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `backend/src/services/tidalService.ts` | Add `getTidalUserId()`, `getUserAlbums()`, `getUserTracks()`         |
| `backend/src/types/tidal.ts`           | Add `TidalUserAlbum`, `TidalUserTrack`, `TidalUserLibraryPage` types |
| `backend/src/server.ts`                | Wire TidalLibrarySyncService, add resolvers to merge                 |

### Frontend - New Files

| File                                                 | Purpose                   |
| ---------------------------------------------------- | ------------------------- |
| `frontend/src/components/library/TidalSyncModal.tsx` | Main sync modal component |
| `frontend/src/components/library/TidalSyncModal.css` | Modal styles              |
| `frontend/src/components/library/SyncButton.tsx`     | "Sync with Tidal" button  |
| `frontend/src/graphql/tidalSync.ts`                  | GraphQL operations        |

### Frontend - Modified Files

| File                                 | Changes                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `frontend/src/pages/LibraryPage.tsx` | Add sync button (header + empty state), modal integration |
| `frontend/src/pages/LibraryPage.css` | Empty state styles, header button placement               |

---

## External References

- **Tidal API OpenAPI Spec**: `tidal/tidal-api-oas.json` - userCollections endpoints (lines 12469-13701)
- **Albums_Attributes Schema**: `tidal/tidal-api-oas.json` (lines 15689-15789)
- **Links/Pagination Schema**: `tidal/tidal-api-oas.json` (lines 18081-18110)
