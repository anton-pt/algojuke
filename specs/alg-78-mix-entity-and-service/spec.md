# Feature Specification: Mix Entity and Service

**Feature Branch**: `alg-78-mix-entity-and-service`
**Created**: 2026-01-17
**Status**: Draft
**Linear Issue**: [ALG-78](https://linear.app/algojuke/issue/ALG-78)
**Input**: Create database schema and CRUD operations for the Mix entity. This is Ticket 1 of the Radio Station Phase 1 implementation. The Mix entity stores radio mixes with music tracks and voice segments.

## Clarifications

### Session 2026-01-17

- Q: Should the Mix entity include a `failureReason` field to store error messages when status is 'failed'? → A: Yes, include optional failureReason field for debugging
- Q: Should Mix have a formal TypeORM relation to Conversation entity, or just store the ID as a string? → A: String ID only - simpler, no cascading concerns
- Q: Should the MixService include a dedicated method for status updates? → A: Include both generic updateMix and dedicated updateMixStatus methods

## User Scenarios & Testing

### US-01: Create a new mix (Priority: P1)

As a user requesting a radio mix, I want the system to create a mix record with "generating" status, so that the worker can track mix generation progress.

**Why P1**: Core functionality - mixes must be created before anything else works.

**Acceptance Scenarios**:

1. **Given** a user triggers mix creation with title "Evening Wind-Down", **When** createMix is called, **Then** a new mix is created with status "generating", empty segments array, and totalDurationMs/characterCount set to 0
2. **Given** a user creates a mix from the chat interface, **When** createMix is called with conversationId, **Then** the mix stores the conversationId for back-reference

---

### US-02: Retrieve user's mixes (Priority: P1)

As a user viewing the Radio screen, I want to see all my mixes sorted by most recent, so that I can access my generated radio mixes.

**Why P1**: Users need to see their mixes in the Radio screen.

**Acceptance Scenarios**:

1. **Given** a user has 3 mixes, **When** they request their mix list, **Then** all 3 mixes are returned sorted by updatedAt DESC
2. **Given** a user has no mixes, **When** they request their mix list, **Then** an empty array is returned
3. **Given** user A requests mixes, **When** the query executes, **Then** no mixes from other users are included

---

### US-03: Update mix status to ready (Priority: P1)

As a worker completing mix generation, I want to update the mix status to "ready", so that the user knows the mix is available for playback.

**Why P1**: Worker must mark mixes as ready when generation completes.

**Acceptance Scenarios**:

1. **Given** a mix with status "generating", **When** the worker updates status to "ready", **Then** the mix status becomes "ready" and failureReason remains null
2. **Given** a mix that was previously "failed", **When** status is updated to "ready", **Then** failureReason is cleared to null

---

### US-04: Update mix status to failed (Priority: P1)

As a worker encountering an error during mix generation, I want to update the mix status to "failed" with a reason, so that the user understands why generation failed.

**Why P1**: Error handling is critical for user experience.

**Acceptance Scenarios**:

1. **Given** a mix with status "generating", **When** generation fails with error "ElevenLabs API quota exceeded", **Then** the mix status becomes "failed" and failureReason is set to the error message
2. **Given** a mix fails without a specific error message, **When** updateMixStatus is called with status "failed", **Then** failureReason defaults to "Unknown error"

---

### US-05: Update mix content (Priority: P2)

As a worker generating mix content, I want to update segments and duration, so that the mix stores the generated timeline.

**Why P2**: Worker updates segments and duration during generation.

**Acceptance Scenarios**:

1. **Given** a mix in "generating" status, **When** worker adds segments and updates totalDurationMs, **Then** segments JSONB contains the segment objects and totalDurationMs reflects total duration
2. **Given** a mix update request, **When** multiple fields are provided, **Then** all provided fields are updated atomically

---

### US-06: Delete a mix (Priority: P2)

As a user who no longer wants a mix, I want to delete it, so that I can manage my mix collection.

**Why P2**: Users should be able to remove old mixes.

**Acceptance Scenarios**:

1. **Given** a user owns a mix, **When** they delete the mix, **Then** the mix is removed from database and deletion returns true
2. **Given** a user tries to delete another user's mix, **When** deleteMix is called, **Then** deletion returns false (user isolation)

---

### US-07: User isolation (Priority: P1)

As a user, I want my mixes to be private and not accessible to other users, so that my content is secure.

**Why P1**: Security - users must not access others' mixes.

**Acceptance Scenarios**:

1. **Given** user A owns mix X and user B requests mix X, **When** getMix is called with user B's ID, **Then** user B receives null (not found)
2. **Given** user A tries to update user B's mix, **When** updateMix is called, **Then** update returns null and no changes are made

## Edge Cases

1. **Get non-existent mix**: Return null, not error
2. **Delete non-existent mix**: Return false, not error
3. **Update non-existent mix**: Return null, not error
4. **Empty title**: Rely on GraphQL validation (future ticket ALG-81)
5. **Very long segments array**: No limit enforced at DB level
6. **Status transition from "ready" to "generating"**: Allowed (no constraint)

## Functional Requirements

| ID     | Requirement                                                               |
| ------ | ------------------------------------------------------------------------- |
| FR-001 | Mix entity has UUID primary key auto-generated                            |
| FR-002 | Mix stores userId as varchar(255) with index                              |
| FR-003 | Mix status is enum: "generating", "ready", "failed" with check constraint |
| FR-004 | Mix segments is JSONB array with MixSegment type                          |
| FR-005 | Mix failureReason is populated only when status is "failed"               |
| FR-006 | MixService verifies user ownership on all read/update/delete operations   |
| FR-007 | MixService has dedicated updateMixStatus method for status transitions    |
| FR-008 | Database migration creates table with check constraint on status          |
| FR-009 | Mix entity has indexes on userId, status, and updatedAt                   |

## Dependencies

- None (this is the foundation for ALG-81 GraphQL API, ALG-83 generateMix tool, ALG-84 API Key Auth)

## Out of Scope

- GraphQL resolvers (ALG-81)
- Agent tool integration (ALG-83)
- API key authentication for service-to-service calls (ALG-84)
- GCS audio file management (future ticket)
- Signed URL generation (future ticket)
- Mix playback logic (future ticket)
