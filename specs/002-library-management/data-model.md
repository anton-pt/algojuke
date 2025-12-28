# Data Model: Personal Music Library

**Feature**: 002-library-management
**Date**: 2025-12-28
**Database**: PostgreSQL with TypeORM

This document defines the database entities for the personal music library feature.

---

## Entity Overview

The library consists of two independent collections:
- **LibraryAlbum**: User's saved albums with cached track listings
- **LibraryTrack**: User's saved individual tracks

**Key Characteristics**:
- Albums and tracks are independent (same track can exist as standalone and within an album)
- Tidal metadata is cached in the database (offline browsing capability)
- Unique constraints prevent duplicates per user
- Alphabetical sorting via indexed columns

---

## Entity: LibraryAlbum

**Table Name**: `library_albums`

**Description**: Represents an album saved to the user's library. Includes complete metadata cached from Tidal API, including track listing for offline browsing.

### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Internal unique identifier |
| `tidal_album_id` | VARCHAR(255) | NOT NULL, UNIQUE | Tidal's album identifier (prevents duplicates) |
| `title` | VARCHAR(255) | NOT NULL | Album title |
| `artist_name` | VARCHAR(255) | NOT NULL, INDEX | Primary artist name (for alphabetical sorting) |
| `cover_art_url` | VARCHAR(500) | NULL | URL to album cover art |
| `release_date` | DATE | NULL | Album release date |
| `track_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of tracks on album |
| `track_listing` | JSONB | NOT NULL, DEFAULT '[]' | Cached track listing from Tidal |
| `metadata` | JSONB | NULL, DEFAULT '{}' | Additional metadata (label, genres, etc.) |
| `user_id` | UUID | NOT NULL | User who added this album |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When album was added to library |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### Indexes

```sql
-- Unique constraint: prevent same album being added twice
CREATE UNIQUE INDEX idx_library_albums_tidal_id ON library_albums (tidal_album_id);

-- Filter by user
CREATE INDEX idx_library_albums_user_id ON library_albums (user_id);

-- Alphabetical sorting by artist then title
CREATE INDEX idx_library_albums_sort ON library_albums (artist_name ASC, title ASC);

-- GIN index for JSONB track listing queries
CREATE INDEX idx_library_albums_tracks_gin ON library_albums USING GIN (track_listing);
```

### JSONB Structure: track_listing

```typescript
interface TrackInfo {
  position: number;      // Track number on album
  title: string;         // Track title
  duration: number;      // Duration in seconds
  tidalId?: string;      // Tidal track ID (optional)
  explicit?: boolean;    // Explicit content flag
}

// Example:
[
  {
    "position": 1,
    "title": "Opening Track",
    "duration": 245,
    "tidalId": "123456",
    "explicit": false
  },
  {
    "position": 2,
    "title": "Second Song",
    "duration": 198,
    "tidalId": "123457",
    "explicit": true
  }
]
```

### TypeORM Entity

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

interface TrackInfo {
  position: number;
  title: string;
  duration: number;
  tidalId?: string;
  explicit?: boolean;
}

@Entity('library_albums')
@Index(['tidalAlbumId'], { unique: true })
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryAlbum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tidal_album_id', length: 255, unique: true })
  tidalAlbumId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'artist_name', length: 255 })
  artistName: string;

  @Column({ name: 'cover_art_url', length: 500, nullable: true })
  coverArtUrl: string | null;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: Date | null;

  @Column({ name: 'track_count', type: 'integer', default: 0 })
  trackCount: number;

  @Column({ name: 'track_listing', type: 'jsonb', default: [] })
  trackListing: TrackInfo[];

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: {
    label?: string;
    genres?: string[];
    explicitContent?: boolean;
    popularity?: number;
  };

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

## Entity: LibraryTrack

**Table Name**: `library_tracks`

**Description**: Represents an individual track saved to the user's library. Tracks exist independently from albums (same track may exist as standalone and within an album per FR-018).

### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Internal unique identifier |
| `tidal_track_id` | VARCHAR(255) | NOT NULL, UNIQUE | Tidal's track identifier (prevents duplicates) |
| `title` | VARCHAR(255) | NOT NULL | Track title |
| `artist_name` | VARCHAR(255) | NOT NULL, INDEX | Primary artist name (for alphabetical sorting) |
| `album_name` | VARCHAR(255) | NULL | Album name this track belongs to |
| `duration` | INTEGER | NOT NULL | Track duration in seconds |
| `cover_art_url` | VARCHAR(500) | NULL | URL to track/album cover art |
| `metadata` | JSONB | NULL, DEFAULT '{}' | Additional metadata (ISRC, genres, etc.) |
| `user_id` | UUID | NOT NULL | User who added this track |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When track was added to library |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### Indexes

```sql
-- Unique constraint: prevent same track being added twice
CREATE UNIQUE INDEX idx_library_tracks_tidal_id ON library_tracks (tidal_track_id);

-- Filter by user
CREATE INDEX idx_library_tracks_user_id ON library_tracks (user_id);

-- Alphabetical sorting by artist then title
CREATE INDEX idx_library_tracks_sort ON library_tracks (artist_name ASC, title ASC);

-- GIN index for JSONB metadata queries
CREATE INDEX idx_library_tracks_metadata_gin ON library_tracks USING GIN (metadata);
```

### TypeORM Entity

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('library_tracks')
@Index(['tidalTrackId'], { unique: true })
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tidal_track_id', length: 255, unique: true })
  tidalTrackId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'artist_name', length: 255 })
  artistName: string;

  @Column({ name: 'album_name', length: 255, nullable: true })
  albumName: string | null;

  @Column({ type: 'integer' })
  duration: number;

  @Column({ name: 'cover_art_url', length: 500, nullable: true })
  coverArtUrl: string | null;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: {
    isrc?: string;
    explicitContent?: boolean;
    popularity?: number;
    genres?: string[];
  };

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

## Relationships

**No Foreign Keys Between Entities**:
- Albums and tracks are independent collections
- Same track can exist as standalone and within an album
- No cascade deletes - removal is independent

**Future User Entity** (when multi-user support added):
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => LibraryAlbum, album => album.userId)
  albums: LibraryAlbum[];

  @OneToMany(() => LibraryTrack, track => track.userId)
  tracks: LibraryTrack[];
}
```

---

## Data Validation Rules

### LibraryAlbum
- `title`: Required, max 255 characters
- `artistName`: Required, max 255 characters
- `tidalAlbumId`: Required, unique, max 255 characters
- `trackListing`: Must be valid JSON array
- `trackCount`: Non-negative integer

### LibraryTrack
- `title`: Required, max 255 characters
- `artistName`: Required, max 255 characters
- `tidalTrackId`: Required, unique, max 255 characters
- `duration`: Positive integer (seconds)

---

## Migration Example

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLibraryTables1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create library_albums table
    await queryRunner.createTable(
      new Table({
        name: 'library_albums',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tidal_album_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'artist_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'cover_art_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'release_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'track_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'track_listing',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes for library_albums
    await queryRunner.createIndex(
      'library_albums',
      new TableIndex({
        name: 'idx_library_albums_user_id',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'library_albums',
      new TableIndex({
        name: 'idx_library_albums_sort',
        columnNames: ['artist_name', 'title'],
      })
    );

    // Create library_tracks table (similar structure)
    // ... (abbreviated for brevity)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('library_tracks');
    await queryRunner.dropTable('library_albums');
  }
}
```

---

## Query Patterns

### Fetch Albums Sorted Alphabetically
```typescript
const albums = await albumRepo.find({
  where: { userId },
  order: {
    artistName: 'ASC',
    title: 'ASC',
  },
});
```

### Fetch Tracks Sorted Alphabetically
```typescript
const tracks = await trackRepo.find({
  where: { userId },
  order: {
    artistName: 'ASC',
    title: 'ASC',
  },
});
```

### Query Track Listing within Album
```sql
-- Find albums containing a specific track title
SELECT * FROM library_albums
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(track_listing) AS track
  WHERE LOWER(track->>'title') LIKE LOWER('%search term%')
);
```

### Check for Duplicates
```typescript
const existing = await albumRepo.findOne({
  where: { tidalAlbumId: 'abc123' },
});

if (existing) {
  throw new Error('Album already in library');
}
```

---

## Performance Considerations

1. **Alphabetical Sorting**: B-tree indexes on `artist_name` + `title` enable fast ORDER BY queries
2. **Duplicate Check**: Unique index on `tidal_album_id`/`tidal_track_id` ensures O(log n) lookup
3. **JSONB Queries**: GIN indexes enable efficient queries on track listings
4. **User Filtering**: Index on `user_id` for multi-user support (future)

---

## Storage Estimates

**Assumptions**:
- Average album: 12 tracks, 300 bytes metadata
- Average track: 150 bytes metadata
- User library: 500 albums + 200 tracks

**Estimated Size**:
- 500 albums × 400 bytes = ~200 KB
- 200 tracks × 200 bytes = ~40 KB
- **Total per user**: ~240 KB

**For 1000 users**: ~240 MB

PostgreSQL handles this scale effortlessly.

---

## Future Enhancements

1. **Full-Text Search**: Add `tsvector` columns for searching album/track titles
2. **Playlist Support**: New `playlists` and `playlist_items` tables
3. **Listen History**: Track play counts and last played timestamps
4. **User Preferences**: Sorting preferences, default views
5. **Soft Delete**: Add `deleted_at` column if undo window needs extension beyond 10 seconds
