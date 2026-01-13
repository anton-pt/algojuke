# Feature Specification: Expose Agent Tools via GraphQL API

**Feature Branch**: `alg-77-expose-agent-tools-via-graphql-api`
**Created**: 2026-01-13
**Status**: Draft
**Linear Issue**: [ALG-77](https://linear.app/algojuke/issue/ALG-77)
**Input**: Expose existing agent tools via GraphQL queries for cross-service invocation. The DJ agent in the worker service needs access to the same tools as the Discover chat agent (semantic search, Tidal search, batch metadata). Add service API key authentication to backend. Configure worker environment for backend API access.

## Clarifications

### Session 2026-01-13

- Q: How should service API key authentication work? → A: Simple API key header - single shared secret in X-API-Key header, validated against env var SERVICE_API_KEY
- Q: Should the GraphQL queries require a userId parameter for personalization, or should they work without user context? → A: Required userId parameter - all queries take userId as input, caller provides it explicitly
- Q: Should the new queries be accessible only via service API key, or also through normal user authentication? → A: Both user and service access - same queries work with either Clerk user auth or service API key + userId

## User Scenarios & Testing

### User Story 1 - Service Auth with API Key (Priority: P1)

As the worker service, I want to call agent tools via GraphQL with an API key so that I can use the same discovery capabilities as the chat agent.

**Why this priority**: Core use case - enables DJ agent to search and discover music.

**Independent Test**: Call `agentSemanticSearch` with X-API-Key header and userId in input.

**Acceptance Scenarios**:

1. **Given** a valid SERVICE_API_KEY in X-API-Key header, **When** I call agentSemanticSearch with userId in input, **Then** I receive search results personalized for that user
2. **Given** an invalid API key, **When** I call any agent tool query, **Then** I receive an UNAUTHENTICATED error
3. **Given** a valid API key but no userId in input, **When** I call any agent tool query, **Then** I receive an UNAUTHENTICATED error requiring userId

---

### User Story 2 - User Auth with Clerk (Priority: P1)

As the frontend, I want to call agent tools via GraphQL with my Clerk token so that I can use the same endpoints for both frontend and service calls.

**Why this priority**: Unified API - same queries work for both auth modes.

**Independent Test**: Call `agentSemanticSearch` with Clerk auth token (no userId in input needed).

**Acceptance Scenarios**:

1. **Given** a valid Clerk auth token, **When** I call agentSemanticSearch without userId in input, **Then** I receive search results personalized for my user
2. **Given** no auth (no API key, no Clerk token), **When** I call any agent tool query, **Then** I receive an UNAUTHENTICATED error
3. **Given** both Clerk auth and userId in input, **When** I call an agent tool query, **Then** the Clerk userId takes precedence (input userId ignored)

---

### User Story 3 - Semantic Search Query (Priority: P1)

As a caller (service or frontend), I want to search indexed tracks by mood/theme so that I can discover music based on semantic meaning.

**Why this priority**: Core discovery tool for DJ agent.

**Independent Test**: Call `agentSemanticSearch(input: { query: "melancholic piano", limit: 10 })`.

**Acceptance Scenarios**:

1. **Given** a valid query, **When** I call agentSemanticSearch, **Then** I receive OptimizedTrackResult[] with shortDescription, score, and library status
2. **Given** an empty query, **When** I call agentSemanticSearch, **Then** I receive a VALIDATION_ERROR
3. **Given** a query longer than 2000 chars, **When** I call agentSemanticSearch, **Then** I receive a VALIDATION_ERROR

---

### User Story 4 - Tidal Search Query (Priority: P1)

As a caller, I want to search the Tidal catalogue by artist/album/track name so that I can find music not yet in my library.

**Why this priority**: Enables finding new music to add to library.

**Independent Test**: Call `agentTidalSearch(input: { query: "Radiohead", searchType: "albums", limit: 5 })`.

**Acceptance Scenarios**:

1. **Given** searchType "tracks", **When** I call agentTidalSearch, **Then** I receive TrackResult[] with library and index status
2. **Given** searchType "albums", **When** I call agentTidalSearch, **Then** I receive AlbumResult[] with library status
3. **Given** searchType "both", **When** I call agentTidalSearch, **Then** I receive both tracks and albums arrays

---

### User Story 5 - Album Tracks Query (Priority: P2)

As a caller, I want to get all tracks from a specific album so that I can explore album contents.

**Why this priority**: Supporting tool for exploring search results.

**Independent Test**: Call `agentAlbumTracks(input: { albumId: "12345678" })`.

**Acceptance Scenarios**:

1. **Given** a valid album ID, **When** I call agentAlbumTracks, **Then** I receive album metadata and TrackResult[] for all tracks
2. **Given** an invalid album ID, **When** I call agentAlbumTracks, **Then** I receive a NOT_FOUND error

---

### User Story 6 - Batch Metadata Query (Priority: P2)

As a caller, I want to get full metadata for multiple ISRCs so that I can enrich track details.

**Why this priority**: Supporting tool for deep-dive after initial search.

**Independent Test**: Call `agentBatchMetadata(input: { isrcs: ["USRC11700001", "GBAYE0700001"] })`.

**Acceptance Scenarios**:

1. **Given** valid ISRCs, **When** I call agentBatchMetadata, **Then** I receive IndexedTrackResult[] with lyrics, interpretation, and audioFeatures
2. **Given** a mix of valid and invalid ISRCs, **When** I call agentBatchMetadata, **Then** I receive results for valid ISRCs and notFound list for invalid ones
3. **Given** more than 100 ISRCs, **When** I call agentBatchMetadata, **Then** I receive a VALIDATION_ERROR

---

## Edge Cases

1. **SERVICE_API_KEY not configured**: Server starts but service auth always fails with appropriate error
2. **Tidal API rate limit**: Return RATE_LIMIT error with retryable=true
3. **Qdrant unavailable**: Return INTERNAL_ERROR with retryable=true
4. **Invalid ISRC format**: Return VALIDATION_ERROR listing invalid ISRCs
5. **Empty search results**: Return success with empty tracks array, totalFound=0

## Functional Requirements

| ID     | Requirement                                                                 |
| ------ | --------------------------------------------------------------------------- |
| FR-001 | Backend must accept service API key via X-API-Key header                    |
| FR-002 | Backend must validate SERVICE_API_KEY from environment variable             |
| FR-003 | Service auth must require userId in GraphQL input                           |
| FR-004 | User auth must use Clerk userId from context                                |
| FR-005 | All four agent tools must be exposed as GraphQL queries                     |
| FR-006 | Response types must use union with AgentToolError for proper error handling |
| FR-007 | Error responses must include code and retryable flag                        |
| FR-008 | Library status (inLibrary, isIndexed) must be included in track results     |

## Dependencies

- @specs/alg-11-agent-tools - Existing tool implementations
- @specs/alg-13-agent-tool-optimization - Optimized semantic search output

## Out of Scope

- `suggestPlaylist` tool (UI-specific, not needed by DJ agent)
- Rate limiting for service calls (future enhancement)
- Worker client implementation (separate ticket)
- Shared TypeScript package (approach changed to GraphQL API)
