# Implementation Plan: Tidal Playlist Export

**Branch**: `017-tidal-playlist-export` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-tidal-playlist-export/spec.md`

## Summary

Add a "Save to Tidal" button to the PlaylistCard component that allows users to export AI-generated playlists to their linked Tidal account. The button opens a modal where users can rename the playlist before saving. The backend creates the playlist via Tidal API using OAuth tokens stored in Clerk private metadata.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**: axios 1.6+ (HTTP), Zod 3.x (validation), Clerk SDK (auth tokens), existing TidalService patterns
**Storage**: Clerk private metadata (user Tidal tokens - existing from 016)
**Testing**: Vitest 1.x (backend), React Testing Library (frontend)
**Target Platform**: Web application (Linux server / modern browsers)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: <10 seconds for playlist save with up to 20 tracks (SC-001), <500ms feedback response (SC-003)
**Constraints**: Tidal API limits (20 items per add request, rate limiting via existing rateLimiter)
**Scale/Scope**: Single user, playlists up to 50 tracks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Test-First Development | PASS | Contract tests for API endpoints, integration tests for Tidal API calls |
| II. Code Quality Standards | PASS | Follows existing TidalService patterns, reuses rate limiter |
| III. User Experience Consistency | PASS | Modal pattern consistent with app, clear error/success feedback |
| IV. Robust Architecture | PASS | Graceful degradation for missing tracks, retry on transient errors |
| V. Security by Design | PASS | Uses existing Clerk auth, tokens via requireAuth middleware |

All gates pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/017-tidal-playlist-export/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   └── playlists.ts           # NEW: POST /api/playlists/export endpoint
│   ├── services/
│   │   ├── tidalService.ts        # EXTEND: Add createPlaylist, addTracksToPlaylist methods
│   │   └── tidalAuthService.ts    # EXISTING: Token retrieval (getTidalTokens)
│   ├── schemas/
│   │   └── playlist.ts            # NEW: Zod schemas for export request/response
│   └── types/
│       └── playlist.ts            # NEW: TypeScript types for playlist export
└── tests/
    ├── contract/
    │   └── playlistExport.test.ts # NEW: Contract tests for export endpoint
    └── integration/
        └── tidalPlaylist.test.ts  # NEW: Integration tests for Tidal API calls

frontend/
├── src/
│   ├── components/
│   │   └── chat/
│   │       ├── PlaylistCard.tsx   # EXTEND: Add Save button
│   │       ├── PlaylistCard.css   # EXTEND: Button styles
│   │       └── SavePlaylistModal.tsx # NEW: Modal component
│   ├── hooks/
│   │   └── usePlaylistExport.ts   # NEW: Hook for export API call
│   └── services/
│       └── playlistApi.ts         # NEW: API client for playlist export
└── tests/
    └── components/chat/
        ├── PlaylistCard.test.tsx  # EXTEND: Button tests
        └── SavePlaylistModal.test.tsx # NEW: Modal tests
```

**Structure Decision**: Web application structure following existing patterns. Backend additions to routes/services, frontend additions to chat components.

## Complexity Tracking

No constitution violations. Complexity is justified by Tidal API requirements (batch limits, user OAuth tokens).
