# Implementation Plan: Playlist Suggestion Agent Tool

**Branch**: `015-playlist-suggestion` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-playlist-suggestion/spec.md`

## Summary

Implement a new agent tool `suggestPlaylist` that enables the chat agent to present visually rich playlist suggestions inline in conversation. The tool accepts a playlist title and array of tracks (with ISRC, title, artist, and reasoning), enriches them via Tidal batch APIs (/tracks and /albums with 20 ID limit), and streams the enriched playlist to the frontend via SSE. The frontend displays a custom playlist card with album artwork and accordion-style reasoning expansion. Tool invocations persist to PostgreSQL like existing tools.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**: Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod 3.x, axios 1.6+, Apollo Server 4.x, Apollo Client 3.x
**Storage**: PostgreSQL (via TypeORM - Message.content JSONB field for tool blocks), existing rate limiter for Tidal API
**Testing**: Vitest 1.x (backend), React Testing Library (frontend)
**Target Platform**: Web application (browser + Node.js server)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Playlist enrichment < 5 seconds for up to 20 tracks (SC-001), SSE events within 500ms of completion (SC-008)
**Constraints**: Tidal API rate limits (2 req/s default), 20 IDs max per /tracks and /albums call, 1-50 tracks per playlist
**Scale/Scope**: Single user (current scope), up to 50 tracks per playlist

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ Pass | Contract tests for schema validation, integration tests for SSE streaming, frontend component tests |
| II. Code Quality Standards | ✅ Pass | Follows existing agent tool patterns (semanticSearch, tidalSearch, etc.), no new complexity beyond established patterns |
| III. User Experience Consistency | ✅ Pass | Inline playlist card consistent with existing tool invocation display, accordion pattern familiar to users |
| IV. Robust Architecture | ✅ Pass | Graceful degradation on Tidal API failures, retry with 1s delay, structured logging via existing logger |
| V. Security by Design | ✅ Pass | ISRC validation at input, no credentials in logs, existing Tidal auth patterns |

## Project Structure

### Documentation (this feature)

```text
specs/015-playlist-suggestion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── playlist-tool-schema.md    # Tool input/output schemas
│   └── sse-playlist-events.md     # SSE event extension for playlist
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── schemas/
│   │   └── agentTools.ts              # Add SuggestPlaylistInputSchema
│   ├── types/
│   │   └── agentTools.ts              # Add SuggestPlaylistOutput, PlaylistTrackItem
│   ├── services/
│   │   ├── agentTools/
│   │   │   ├── suggestPlaylistTool.ts # NEW: Tool implementation
│   │   │   └── index.ts               # Export new tool
│   │   ├── chatStreamService.ts       # Register suggestPlaylist tool
│   │   └── tidalService.ts            # Add public batch methods (expose existing private methods)
│   └── prompts/
│       └── chatSystemPrompt.ts        # Add tool description for agent
└── tests/
    └── contract/
        └── agentTools/
            └── suggestPlaylistTool.test.ts  # NEW: Schema & output tests

frontend/
├── src/
│   ├── components/
│   │   └── chat/
│   │       ├── PlaylistCard.tsx       # NEW: Playlist display component
│   │       ├── PlaylistCard.css       # NEW: Styles
│   │       ├── ToolInvocation.tsx     # Add playlist case handling
│   │       └── ChatMessage.tsx        # Handle playlist tool_use blocks
│   └── hooks/
│       └── useChatStream.ts           # Handle suggestPlaylist events (minimal changes)
└── tests/
    └── components/
        └── chat/
            └── PlaylistCard.test.tsx  # NEW: Component tests
```

**Structure Decision**: Follows existing web application structure with backend/frontend separation. New tool follows established agentTools pattern. PlaylistCard is a new component because the playlist display differs significantly from generic tool result expansion.

## Complexity Tracking

No constitution violations requiring justification. The implementation follows established patterns for:
- Agent tool definition (same as semanticSearch, tidalSearch, etc.)
- SSE event streaming (same event types, new tool name)
- PostgreSQL persistence (same ContentBlock schema)
- Tidal API batch calls (reuses existing batchFetchTracks, batchFetchAlbums patterns with chunking)

## Key Architectural Decisions

### Decision 1: Tidal API Chunking Strategy

Given the 20 ID limit per Tidal API call and up to 50 tracks per playlist:

- **Tracks API**: Chunk ISRCs into batches of 20, call sequentially (respects rate limiter)
- **Albums API**: Use existing `batchFetchAlbums` which already handles 20-album chunking
- **Parallelism**: Sequential calls within rate limiter, not parallel (existing pattern)

### Decision 2: Playlist Tool Output vs Tool Invocation Display

Two display modes for playlists:

1. **During streaming**: Standard ToolInvocation component shows "Building playlist..." status
2. **After completion**: PlaylistCard component renders the enriched playlist inline

The ToolInvocation component will detect `toolName === 'suggestPlaylist'` and render PlaylistCard instead of the generic results renderer.

### Decision 3: Enriched Data Persistence

Store the fully enriched playlist (with Tidal metadata) in the `tool_result` content block, not just the agent input. This ensures historical conversations display playlists with artwork without re-fetching from Tidal.

### Decision 4: Fallback Handling

When Tidal enrichment fails for some tracks:
- Use agent-provided title/artist
- Set `artworkUrl` to null (frontend shows placeholder)
- Set `enriched: false` flag on the track
- Never emit `tool_call_error` for partial failures - emit `tool_call_end` with available data

## Dependencies

| Dependency | Usage | Already in Codebase |
|------------|-------|---------------------|
| Vercel AI SDK `tool()` | Tool definition | ✅ Yes |
| Zod schemas | Input validation | ✅ Yes |
| TidalService | Batch track/album fetching | ✅ Yes (expose private methods as public) |
| RateLimiter | Tidal API throttling | ✅ Yes |
| Langfuse tracing | Observability | ✅ Yes |
| ContentBlock schema | Persistence | ✅ Yes |
| SSE streaming | Event delivery | ✅ Yes |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tidal API rate limiting | Medium | Medium | Use existing rate limiter, sequential chunked calls |
| Large playlist payload | Low | Low | 50 track limit, 160x160 artwork URLs (not base64) |
| Frontend render performance | Low | Low | Virtualization not needed for <50 items |
| Album art 404s | Low | Medium | Placeholder image fallback, CSS background-image with fallback |

## Phase 0-2 Artifacts

1. **research.md**: Tidal API batch endpoints, existing tool patterns, SSE event extension approach
2. **data-model.md**: PlaylistSuggestionInput, EnrichedPlaylist, PlaylistTrackItem schemas
3. **contracts/**: Tool schema contract, SSE event contract extending 011 patterns
4. **quickstart.md**: Development setup, testing the tool manually
