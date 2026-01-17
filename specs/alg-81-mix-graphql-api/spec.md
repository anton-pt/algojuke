# Feature Specification: Mix GraphQL API

**Feature Branch**: `alg-81-mix-graphql-api`
**Created**: 2026-01-17
**Status**: Draft
**Linear Issue**: [ALG-81](https://linear.app/algojuke/issue/ALG-81)
**Input**: Expose Mix operations via GraphQL. This is Ticket 2 of the Radio Station Phase 1 implementation. Includes Mix type, MixSegment union, MixStatus enum, queries (mixes, mix), and deleteMix mutation with union result types.

## Clarifications

### Session 2026-01-17

- Q: Should the `mixes` query support pagination, or return all mixes for now (v1)? → A: No pagination for v1 - return all user's mixes
- Q: Should deleteMix use union types for Success | Error, or throw GraphQL errors directly? → A: Union types, consistent with chatResolver pattern
- Q: Should the spec include GraphQL subscriptions for real-time status updates? → A: No subscriptions for v1

## User Scenarios & Testing

### US-01: Query all mixes (Priority: P1)

As a user viewing the Radio screen, I want to query all my mixes, so that I can see my generated radio mixes.

**Why P1**: Radio screen needs mix list to display.

**Acceptance Scenarios**:

1. **Given** an authenticated user with 3 mixes, **When** they query `mixes`, **Then** MixList is returned with all 3 mixes sorted by updatedAt DESC and totalCount=3
2. **Given** an authenticated user with no mixes, **When** they query `mixes`, **Then** MixList is returned with empty array and totalCount=0
3. **Given** an unauthenticated request, **When** `mixes` is queried, **Then** MixError is returned with code UNAUTHORIZED

---

### US-02: Query single mix (Priority: P1)

As a user viewing mix details, I want to query a specific mix by ID, so that I can see the full mix with segments.

**Why P1**: Mix details/playback screen needs full mix data.

**Acceptance Scenarios**:

1. **Given** an authenticated user owns mix X, **When** they query `mix(id: X)`, **Then** the full Mix object is returned with all segments
2. **Given** an authenticated user queries a non-existent mix ID, **When** `mix(id: invalid)` is called, **Then** MixError is returned with code NOT_FOUND
3. **Given** user A queries mix owned by user B, **When** `mix(id: B's-mix)` is called, **Then** MixError is returned with code NOT_FOUND (user isolation)

---

### US-03: Delete a mix (Priority: P2)

As a user managing my mix collection, I want to delete a mix, so that I can remove mixes I no longer want.

**Why P2**: User should be able to manage their mix collection.

**Acceptance Scenarios**:

1. **Given** an authenticated user owns mix X, **When** they call `deleteMix(id: X)`, **Then** DeleteMixSuccess is returned with deletedId and mix is removed from database
2. **Given** an authenticated user tries to delete a non-existent mix, **When** `deleteMix(id: invalid)` is called, **Then** MixError is returned with code NOT_FOUND
3. **Given** user A tries to delete user B's mix, **When** `deleteMix(id: B's-mix)` is called, **Then** MixError is returned with code NOT_FOUND (user isolation)

---

### US-04: Handle authentication errors (Priority: P1)

As the system, I want to reject unauthenticated requests, so that user data is protected.

**Why P1**: Security requirement.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request, **When** any mix query/mutation is called, **Then** MixError is returned with code UNAUTHORIZED and retryable=false

---

### US-05: Resolve MixSegment union type (Priority: P1)

As a client consuming the API, I want MixSegment to resolve correctly to MusicSegment or VoiceSegment, so that I can render segment-specific UI.

**Why P1**: Core to the mix playback experience.

**Acceptance Scenarios**:

1. **Given** a mix with segments of type "music", **When** queried, **Then** segments resolve to MusicSegment with music-specific fields
2. **Given** a mix with segments of type "voice", **When** queried, **Then** segments resolve to VoiceSegment with voice-specific fields
3. **Given** a mix with mixed segment types, **When** queried with GraphQL fragment spread, **Then** correct fields are returned for each segment type

## Edge Cases

1. **Empty segments array**: Return Mix with empty segments array, not error
2. **Database error during query**: Return MixError with code DATABASE_ERROR, retryable=true
3. **Invalid UUID format for mix ID**: Return MixError with code NOT_FOUND (treat as not found)
4. **Concurrent delete of same mix**: First succeeds, second returns NOT_FOUND

## Functional Requirements

| ID     | Requirement                                                                                 |
| ------ | ------------------------------------------------------------------------------------------- |
| FR-001 | `mixes` query returns MixesResult union (MixList \| MixError)                               |
| FR-002 | `mix(id: ID!)` query returns MixResult union (Mix \| MixError)                              |
| FR-003 | `deleteMix(id: ID!)` mutation returns DeleteMixResult union (DeleteMixSuccess \| MixError)  |
| FR-004 | All operations call `requireAuth(context, "operationName")` before processing               |
| FR-005 | MixStatus enum has values: GENERATING, READY, FAILED                                        |
| FR-006 | MixSegment union resolves via `type` field ("music" → MusicSegment, "voice" → VoiceSegment) |
| FR-007 | MixError includes message, code (MixErrorCode enum), and retryable boolean                  |
| FR-008 | Mix.segments returns [MixSegment!]! (non-null array of non-null segments)                   |
| FR-009 | Dates (createdAt, updatedAt) returned as ISO-8601 strings                                   |

## Schema Definition

```graphql
enum MixStatus {
  GENERATING
  READY
  FAILED
}

enum MixErrorCode {
  NOT_FOUND
  UNAUTHORIZED
  DATABASE_ERROR
  INTERNAL_ERROR
}

type MusicSegment {
  id: ID!
  type: String!
  startMs: Int!
  endMs: Int!
  durationMs: Int!
  tidalTrackId: String
  isrc: String
  trackTitle: String
  artistName: String
  albumArtUrl: String
}

type VoiceSegment {
  id: ID!
  type: String!
  startMs: Int!
  endMs: Int!
  durationMs: Int!
  audioUrl: String
  sourceType: String
  sourceId: String
  sourceTitle: String
  sourceUrl: String
  contentMode: String
}

union MixSegment = MusicSegment | VoiceSegment

type Mix {
  id: ID!
  title: String!
  description: String
  status: MixStatus!
  failureReason: String
  segments: [MixSegment!]!
  totalDurationMs: Int!
  characterCount: Int!
  conversationId: String
  createdAt: String!
  updatedAt: String!
}

type MixList {
  mixes: [Mix!]!
  totalCount: Int!
}

type MixError {
  message: String!
  code: MixErrorCode!
  retryable: Boolean!
}

type DeleteMixSuccess {
  deletedId: ID!
  message: String!
}

union MixesResult = MixList | MixError
union MixResult = Mix | MixError
union DeleteMixResult = DeleteMixSuccess | MixError

extend type Query {
  mixes: MixesResult!
  mix(id: ID!): MixResult!
}

extend type Mutation {
  deleteMix(id: ID!): DeleteMixResult!
}
```

## Dependencies

- @specs/alg-78-mix-entity-and-service (Mix entity and MixService)

## Pattern Reference

- `backend/src/resolvers/chatResolver.ts` - Union type pattern, auth guards
- `backend/src/schema/chat.graphql` - Schema union definitions

## Out of Scope

- Pagination for mixes list (v1)
- GraphQL subscriptions for real-time status updates
- Create/Update mutations (worker uses MixService directly)
- Mix playback control APIs
- Filtering/sorting options for mixes query
