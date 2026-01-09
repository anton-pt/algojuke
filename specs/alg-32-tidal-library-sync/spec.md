# Feature Specification: Tidal Library Synchronisation Flow

**Feature Branch**: `alg-32-tidal-library-sync`
**Created**: 2026-01-09
**Status**: Draft
**Linear Issue**: [ALG-32](https://linear.app/algojuke/issue/ALG-32)
**Input**: On the Library screen (introduced in ALG-6) there should be a new button "Sync with Tidal" button that fetches the user's library albums and tracks from Tidal, takes a diff of what's currently in the user's AlgoJuke library vs Tidal library, and offers to import missing items (selecting one by one or importing everything).

## Clarifications

### Session 2026-01-09

- Q: How should the sync handle albums where the user saved individual tracks from that album to Tidal (not the full album)? → A: Import both separately - tracks saved in Tidal appear as tracks, albums as albums
- Q: Should the sync be a one-time import operation, or should users be able to see what's different and selectively sync? → A: Diff with selection - show what's in Tidal but not in AlgoJuke, let user pick items to import
- Q: Should users be able to remove items from AlgoJuke that are no longer in their Tidal library during sync? → A: Import only - only add new items from Tidal, never remove existing AlgoJuke items
- Q: How should pagination/progress work for users with large Tidal libraries? → A: Paginated diff view - show diff in pages (50 items at a time) with "Load More" button

## User Scenarios & Testing

### User Story 1 - Sync Button Visibility (Priority: P1)

As a user, I want to see a "Sync with Tidal" button on my library screen so that I can import my Tidal library.

**Why this priority**: The sync button is the entry point to the entire feature. Without it being visible and properly positioned, users cannot access the sync functionality.

**Acceptance Scenarios**:

1. **Given** my library is empty and I have a Tidal connection, **When** I view the Library page, **Then** I see a prominent central "Sync with Tidal" button
2. **Given** my library has content and I have a Tidal connection, **When** I view the Library page, **Then** I see a "Sync with Tidal" button in the top-right header area
3. **Given** I don't have a Tidal connection, **When** I view the Library page, **Then** I don't see the sync button (or see a "Connect Tidal" prompt instead)

---

### User Story 2 - View Album Diff (Priority: P1)

As a user, I want to see which albums are in my Tidal library but not in AlgoJuke so that I can decide what to import.

**Why this priority**: This is the core value - showing users what's missing. Albums are a primary way users organize music.

**Acceptance Scenarios**:

1. **Given** I click "Sync with Tidal", **When** the modal opens, **Then** I see a list of Tidal albums not in my AlgoJuke library
2. **Given** I have albums in both Tidal and AlgoJuke, **When** I view the diff, **Then** I only see albums missing from AlgoJuke (not duplicates)
3. **Given** I have more than 50 albums to import, **When** I view the diff, **Then** I see the first 50 with a "Load More" button
4. **Given** all my Tidal albums are already in AlgoJuke, **When** I view the diff, **Then** I see an empty state message ("All albums synced")

---

### User Story 3 - View Track Diff (Priority: P1)

As a user, I want to see which tracks are in my Tidal library but not in AlgoJuke so that I can decide what to import.

**Why this priority**: Tracks are equally important as albums - users may save individual tracks without full albums.

**Acceptance Scenarios**:

1. **Given** I'm in the sync modal, **When** I switch to the "Tracks" tab, **Then** I see Tidal tracks not in my AlgoJuke library
2. **Given** I have individual tracks saved in Tidal (not full albums), **When** I view the track diff, **Then** these appear as tracks to import
3. **Given** I have more than 50 tracks to import, **When** I view the diff, **Then** I see the first 50 with a "Load More" button
4. **Given** all my Tidal tracks are already in AlgoJuke, **When** I view the diff, **Then** I see an empty state message ("All tracks synced")

---

### User Story 4 - Selective Import (Priority: P2)

As a user, I want to select specific items to import from my Tidal library so that I can curate what goes into AlgoJuke.

**Why this priority**: Selective import gives users control over their library curation, but requires the diff view (P1) first.

**Acceptance Scenarios**:

1. **Given** I'm viewing the album diff, **When** I check individual album checkboxes and click "Import Selected", **Then** only the selected albums are added to my library
2. **Given** I want to import everything on the current page, **When** I click "Select All", **Then** all visible items are checked
3. **Given** I want to deselect all items, **When** I click "Select All" again, **Then** all visible items are unchecked
4. **Given** I've selected items, **When** the import completes, **Then** I see a success message with count of imported items
5. **Given** I've imported items, **When** I view the diff again, **Then** the imported items no longer appear in the list

---

### User Story 5 - Import All (Priority: P2)

As a user, I want to import everything from my Tidal library at once so that I can quickly populate my AlgoJuke library.

**Why this priority**: Convenience feature for users who want full sync without manual selection.

**Acceptance Scenarios**:

1. **Given** I'm viewing the diff, **When** I click "Import All", **Then** all missing items (albums or tracks for current tab) are queued for import
2. **Given** import is in progress, **When** I watch the UI, **Then** I see a progress indicator showing items imported
3. **Given** a large import is running, **When** I close the modal, **Then** the import continues in the background (or user is warned that closing will cancel)

---

### User Story 6 - Error Handling (Priority: P3)

As a user, I want clear feedback when something goes wrong during sync so that I can take appropriate action.

**Why this priority**: Error handling improves user experience but core functionality works without it.

**Acceptance Scenarios**:

1. **Given** my Tidal token has expired, **When** I try to sync, **Then** I see a "Reconnect Tidal" prompt that initiates the OAuth flow
2. **Given** the Tidal API is unavailable, **When** I try to sync, **Then** I see an error message with a retry option
3. **Given** some items fail to import, **When** import completes, **Then** I see which items failed and why
4. **Given** rate limiting occurs during import, **When** I watch the progress, **Then** the import slows down gracefully (not fails entirely)

---

## Functional Requirements

| ID     | Requirement                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| FR-001 | System shall fetch user's Tidal albums via `GET /userCollections/{id}/relationships/albums`                |
| FR-002 | System shall fetch user's Tidal tracks via `GET /userCollections/{id}/relationships/tracks`                |
| FR-003 | System shall calculate diff by comparing Tidal item IDs against existing LibraryAlbum/LibraryTrack records |
| FR-004 | System shall support cursor-based pagination with 50 items per page                                        |
| FR-005 | System shall reuse existing `addAlbumToLibrary`/`addTrackToLibrary` methods for imports                    |
| FR-006 | System shall handle token refresh automatically when access token is expired                               |
| FR-007 | System shall respect existing rate limits for Tidal API calls (via RateLimiter)                            |
| FR-008 | System shall display album cover art, title, artist name, and track count in diff view                     |
| FR-009 | System shall display track cover art, title, artist name, album name, and duration in diff view            |

## Edge Cases

1. **Empty Tidal library**: User has connected Tidal but has no saved albums/tracks - show appropriate empty state
2. **Fully synced library**: All Tidal items already exist in AlgoJuke - show "All synced" message
3. **Token expiry mid-sync**: Access token expires during paginated fetch or import - attempt refresh, fail gracefully if refresh fails
4. **Network failure during import**: Some items imported, some fail - report partial success with list of failures
5. **Duplicate detection**: Item added to AlgoJuke between diff calculation and import attempt - skip gracefully (already exists)
6. **Large library pagination**: User has 500+ albums - ensure pagination works correctly without memory issues

## Out of Scope

- Bidirectional sync (removing AlgoJuke items not in Tidal)
- Automatic/scheduled sync (manual trigger only)
- Sync status persistence (no "last synced" timestamp tracking)
- Syncing playlists from Tidal (albums and tracks only)
- Syncing artists (favorites) from Tidal

## Dependencies

- @specs/alg-6-library-management (Library entities and services)
- @specs/alg-16-clerk-tidal-auth (Tidal OAuth tokens stored in Clerk private metadata)
