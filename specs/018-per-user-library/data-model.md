# Data Model: Per-User Music Library Storage

**Feature**: 018-per-user-library
**Date**: 2026-01-04

## Terminology

- **userId**: The camelCase property name used in TypeScript code (e.g., `context.userId`, `album.userId`)
- **user_id**: The snake_case column name in PostgreSQL database schema
- **Clerk user ID**: The string identifier provided by Clerk authentication (e.g., `user_2abc123...`)

All three refer to the same value; the naming varies by context (code vs. database vs. external service).

## Overview

This document describes the data model changes required to support per-user library and conversation isolation. The existing schema already includes `userId` columns; the primary changes involve constraint modifications and ensuring proper user association.

## Entity Changes

### LibraryAlbum

**File**: `backend/src/entities/LibraryAlbum.ts`

**Current State**:
```typescript
@Entity('library_albums')
@Index(['tidalAlbumId'], { unique: true })  // GLOBAL unique - prevents multi-user
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryAlbum {
  // ... existing fields including userId
}
```

**Required Change**:
```typescript
@Entity('library_albums')
@Index(['tidalAlbumId', 'userId'], { unique: true })  // COMPOSITE unique - per-user
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryAlbum {
  @Column({ name: 'tidal_album_id', type: 'varchar', length: 255 })  // Remove unique: true
  tidalAlbumId!: string;

  // ... rest unchanged
}
```

**Validation Rules**:
- `tidalAlbumId` + `userId` must be unique (same album can exist in multiple users' libraries)
- `userId` is required (NOT NULL)

### LibraryTrack

**File**: `backend/src/entities/LibraryTrack.ts`

**Current State**:
```typescript
@Entity('library_tracks')
@Index(['tidalTrackId'], { unique: true })  // GLOBAL unique - prevents multi-user
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryTrack {
  // ... existing fields including userId
}
```

**Required Change**:
```typescript
@Entity('library_tracks')
@Index(['tidalTrackId', 'userId'], { unique: true })  // COMPOSITE unique - per-user
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryTrack {
  @Column({ name: 'tidal_track_id', type: 'varchar', length: 255 })  // Remove unique: true
  tidalTrackId!: string;

  // ... rest unchanged
}
```

**Validation Rules**:
- `tidalTrackId` + `userId` must be unique (same track can exist in multiple users' libraries)
- `userId` is required (NOT NULL)

### Conversation

**File**: `backend/src/entities/Conversation.ts`

**Current State**: Already has `userId` column with proper index. No schema changes needed.

**Validation Rules**:
- `userId` is required (NOT NULL)
- Messages inherit user ownership via conversation relationship

### Message

**File**: `backend/src/entities/Message.ts`

**Current State**: Has `conversationId` foreign key with CASCADE delete. No schema changes needed.

**Validation Rules**:
- User ownership is derived from parent Conversation
- Deleted with conversation via CASCADE

## Database Schema

### Table: library_albums

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PRIMARY KEY | Auto-generated |
| tidal_album_id | varchar(255) | NOT NULL | Composite unique with user_id |
| user_id | uuid | NOT NULL | Owner's Clerk user ID |
| title | varchar(255) | NOT NULL | |
| artist_name | varchar(255) | NOT NULL | |
| cover_art_url | varchar(500) | NULL | |
| release_date | date | NULL | |
| track_count | integer | DEFAULT 0 | |
| track_listing | jsonb | DEFAULT '[]' | |
| metadata | jsonb | DEFAULT '{}' | |
| created_at | timestamp | DEFAULT NOW | |
| updated_at | timestamp | DEFAULT NOW | |

**Indexes**:
- `idx_library_albums_tidal_album_user` UNIQUE (tidal_album_id, user_id)
- `idx_library_albums_user_id` (user_id)
- `idx_library_albums_sort` (artist_name, title)

### Table: library_tracks

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PRIMARY KEY | Auto-generated |
| tidal_track_id | varchar(255) | NOT NULL | Composite unique with user_id |
| user_id | uuid | NOT NULL | Owner's Clerk user ID |
| title | varchar(255) | NOT NULL | |
| artist_name | varchar(255) | NOT NULL | |
| album_name | varchar(255) | NULL | |
| duration | integer | NOT NULL | |
| cover_art_url | varchar(500) | NULL | |
| metadata | jsonb | DEFAULT '{}' | |
| created_at | timestamp | DEFAULT NOW | |
| updated_at | timestamp | DEFAULT NOW | |

**Indexes**:
- `idx_library_tracks_tidal_track_user` UNIQUE (tidal_track_id, user_id)
- `idx_library_tracks_user_id` (user_id)
- `idx_library_tracks_sort` (artist_name, title)

### Table: conversations

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PRIMARY KEY | Auto-generated, also Langfuse session ID |
| user_id | uuid | NOT NULL | Owner's Clerk user ID |
| created_at | timestamp with time zone | DEFAULT NOW | |
| updated_at | timestamp with time zone | DEFAULT NOW | |

**Indexes**:
- `idx_conversations_user_id` (user_id)
- `idx_conversations_updated_at` (updated_at)

### Table: messages

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PRIMARY KEY | Auto-generated |
| conversation_id | uuid | FK → conversations.id ON DELETE CASCADE | |
| role | varchar(20) | CHECK (role IN ('user', 'assistant')) | |
| content | jsonb | DEFAULT '[]' | Content blocks array |
| created_at | timestamp with time zone | DEFAULT NOW | |

**Indexes**:
- `idx_messages_conversation_id` (conversation_id)
- `idx_messages_created_at` (created_at)

## Migration

### Migration: EnableMultiUserLibrary

**Timestamp**: 1736000000000 (or similar)
**File**: `backend/src/migrations/1736000000000-EnableMultiUserLibrary.ts`

**Up Migration**:
1. Get Clerk userId for anton.tcholakov@gmail.com
2. Update all existing library_albums with this userId (if any have placeholder)
3. Update all existing library_tracks with this userId (if any have placeholder)
4. Update all existing conversations with this userId (if any have placeholder)
5. Drop unique constraint on library_albums.tidal_album_id
6. Drop unique constraint on library_tracks.tidal_track_id
7. Create composite unique index on (tidal_album_id, user_id)
8. Create composite unique index on (tidal_track_id, user_id)

**Down Migration**:
1. Drop composite unique indexes
2. Create original unique constraints (may fail if duplicate items exist)

**Note**: The down migration may fail if multiple users have added the same album/track. This is acceptable as reverting this migration would break multi-user functionality.

## Query Patterns

### User-Filtered Queries

All library queries MUST include userId filter:

```typescript
// Get user's albums
const albums = await repo.find({
  where: { userId },
  order: { artistName: 'ASC', title: 'ASC' }
});

// Get specific album with ownership check
const album = await repo.findOne({
  where: { id: albumId, userId }
});
// Returns null if album doesn't exist OR belongs to different user

// Check if track in user's library
const isInLibrary = await repo.exists({
  where: { tidalTrackId, userId }
});
```

### Duplicate Prevention

Adding an item checks for existing user-specific entry:

```typescript
// Check before adding
const existing = await repo.findOne({
  where: { tidalAlbumId, userId }
});
if (existing) {
  throw new DuplicateEntryError();
}
```

### Cross-User Protection

Service methods MUST verify ownership:

```typescript
// Reject access to other users' conversations
async getConversation(id: string, userId: string) {
  const conv = await repo.findOne({ where: { id, userId } });
  if (!conv) {
    // Log access attempt
    logSecurityEvent('ACCESS_VIOLATION', { userId, targetResource: { type: 'conversation', id } });
    return null;
  }
  return conv;
}
```

## Performance Considerations

### Index Usage

- `idx_*_user_id` indexes support efficient user-filtered queries
- Composite unique indexes serve dual purpose: uniqueness + query optimization
- Sort indexes (`artist_name`, `title`) support efficient ordering

### Query Optimization

- Always filter by `userId` first (most selective)
- Use indexed columns in WHERE clauses
- Avoid full table scans by including `userId` in all queries

### Expected Performance

Based on existing performance targets:
- Library browse (up to 500 items): < 2 seconds
- Single item lookup: < 100ms
- Add/remove operations: < 500ms
