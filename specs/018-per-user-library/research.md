# Research: Per-User Music Library Storage

**Feature**: 018-per-user-library
**Date**: 2026-01-04

## Executive Summary

The codebase is already well-prepared for multi-user support. The database schema includes `userId` columns on all relevant tables with proper indexes. The primary work involves:

1. Changing unique constraints from global to per-user composite keys
2. Updating resolvers to use authenticated userId instead of hardcoded mock IDs
3. Adding authentication enforcement and security logging
4. Migrating existing data to the known user (anton.tcholakov@gmail.com)

## Research Findings

### 1. Current Schema State

**Decision**: Modify existing unique constraints rather than adding new columns

**Rationale**:
- `userId` column already exists on `library_albums`, `library_tracks`, and `conversations` tables
- Existing indexes on `userId` column are appropriate for user-filtered queries
- The schema design anticipated multi-user support

**Current Issue**:
- `tidalAlbumId` and `tidalTrackId` have GLOBAL unique constraints
- This prevents multiple users from having the same album/track
- Must change to COMPOSITE unique constraint on `(tidalAlbumId, userId)` and `(tidalTrackId, userId)`

**Alternatives Considered**:
- Creating new tables with proper constraints: Rejected (unnecessary complexity, data migration overhead)
- Adding separate user_item junction tables: Rejected (over-engineering for current needs)

### 2. Authentication Integration Pattern

**Decision**: Leverage existing Clerk middleware with a lightweight GraphQL auth guard

**Rationale**:
- `clerkAuth.ts` already provides `getAuth(req)` to extract userId
- Server context already passes `userId` to resolvers (line 194-214 in server.ts)
- Resolvers currently ignore `context.userId` and use hardcoded `CURRENT_USER_ID`

**Implementation Approach**:
1. Create `authGuard.ts` utility that throws `AuthenticationError` if `context.userId` is undefined
2. Call auth guard at the start of each protected resolver
3. Remove all `CURRENT_USER_ID` constants and fallbacks

**Alternatives Considered**:
- Apollo Server auth plugin: Rejected (heavier than needed for this use case)
- Directive-based auth (@auth directive): Rejected (requires schema changes, more complex setup)
- Middleware-only approach: Rejected (GraphQL requests bypass Express middleware)

### 3. Data Migration Strategy

**Decision**: Single TypeORM migration with data update and constraint changes

**Rationale**:
- Small data volume (private beta, single user)
- Known target user email: anton.tcholakov@gmail.com
- Need to handle the Clerk userId for this user

**Migration Steps**:
1. Look up Clerk userId for anton.tcholakov@gmail.com (or use hardcoded ID if known)
2. Update all existing `library_albums`, `library_tracks`, `conversations` to use this userId
3. Drop global unique constraints on `tidalAlbumId` and `tidalTrackId`
4. Create composite unique constraints on `(tidalAlbumId, userId)` and `(tidalTrackId, userId)`

**Alternatives Considered**:
- Separate migration scripts: Rejected (atomic migration is safer)
- Keep global constraints and fail duplicates: Rejected (violates FR-011 requirement)

### 4. User Ownership Verification

**Decision**: Add ownership checks in service layer, not just resolvers

**Rationale**:
- Defense in depth: multiple layers of protection
- Services are called from multiple entry points (GraphQL resolvers, REST endpoints, agent tools)
- Prevents accidental cross-user data access

**Implementation Pattern**:
```typescript
// In service methods
async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
  const conversation = await this.repo.findOne({ where: { id: conversationId, userId } });
  if (!conversation) return null; // Not found OR not owned by user
  return conversation;
}
```

**Alternatives Considered**:
- Resolver-only checks: Rejected (doesn't protect REST endpoints or agent tools)
- Database-level RLS (Row-Level Security): Rejected (PostgreSQL RLS adds complexity, not needed for this scale)

### 5. Security Logging Approach

**Decision**: Structured logging with console output (existing observability via Langfuse)

**Rationale**:
- Langfuse already provides tracing for chat operations
- Simple structured logs for auth failures and access violations
- No need for dedicated log aggregation service at this scale

**Log Events**:
- `AUTH_FAILURE`: Unauthenticated request to protected operation
- `ACCESS_VIOLATION`: Authenticated user attempting to access another user's data

**Log Format**:
```typescript
{
  event: 'ACCESS_VIOLATION',
  timestamp: ISO8601,
  userId: string,
  targetResource: { type: 'conversation' | 'album' | 'track', id: string },
  requestOrigin: string,
}
```

**Alternatives Considered**:
- Dedicated audit log table: Rejected (over-engineering for current needs)
- External logging service: Rejected (adds infrastructure complexity)

### 6. Agent Tool Context Propagation

**Decision**: Remove fallback to CURRENT_USER_ID, require userId in context

**Rationale**:
- Agent tools are only invoked from authenticated chat sessions
- chatStreamService.ts already extracts and passes userId
- Fallback masks potential bugs where userId isn't properly passed

**Implementation**:
- Remove `const userId = context.userId || CURRENT_USER_ID;` pattern
- Use `context.userId` directly
- Add validation that context.userId exists before processing

**Alternatives Considered**:
- Keep fallback for backwards compatibility: Rejected (creates security risk, masks bugs)

### 7. Unique Constraint Migration Safety

**Decision**: Drop and recreate constraints in same migration with explicit constraint names

**Rationale**:
- TypeORM generates constraint names deterministically
- Can safely drop by name and create new composite constraints
- Migration is reversible

**SQL Operations**:
```sql
-- Drop global unique constraints
ALTER TABLE library_albums DROP CONSTRAINT "UQ_library_albums_tidal_album_id";
ALTER TABLE library_tracks DROP CONSTRAINT "UQ_library_tracks_tidal_track_id";

-- Create composite unique constraints
CREATE UNIQUE INDEX "IDX_library_albums_tidal_album_user" ON library_albums (tidal_album_id, user_id);
CREATE UNIQUE INDEX "IDX_library_tracks_tidal_track_user" ON library_tracks (tidal_track_id, user_id);
```

**Alternatives Considered**:
- Leave constraints as-is: Rejected (violates FR-011)
- Soft uniqueness in application layer: Rejected (database constraints are safer)

## Resolved Clarifications

All technical unknowns have been resolved through codebase exploration:

| Unknown | Resolution |
|---------|-----------|
| Clerk userId availability | Already passed in GraphQL context via `getAuth(req)` |
| Existing schema state | userId columns exist; only constraints need updating |
| Migration target user | anton.tcholakov@gmail.com (from spec clarification) |
| Auth enforcement pattern | Lightweight guard function + service-level checks |
| Agent tool context | Already receives userId; remove fallbacks |

## Dependencies Verified

| Dependency | Status | Notes |
|------------|--------|-------|
| Clerk SDK integration | ✅ Ready | Middleware and context extraction working |
| TypeORM migrations | ✅ Ready | Existing migration pattern to follow |
| GraphQL context | ✅ Ready | userId already passed to resolvers |
| Agent tool context | ✅ Ready | userId passed via tool context |

## Next Steps

1. **Phase 1**: Generate data-model.md documenting schema changes
2. **Phase 1**: Generate contracts/ documenting GraphQL resolver changes
3. **Phase 1**: Generate quickstart.md with migration instructions
4. **Phase 2**: Generate tasks.md with implementation tasks
