# Research Findings: Personal Music Library Management

**Date**: 2025-12-28
**Feature**: 002-library-management
**Context**: TypeScript/React 18/Apollo Server 4/TypeORM/PostgreSQL implementation

This document consolidates research findings for implementing a personal music library with PostgreSQL persistence, GraphQL API, and undo functionality.

---

## 1. TypeORM + PostgreSQL Configuration

### Decision: DataSource with Environment-Based Configuration

**Rationale**: TypeORM `DataSource` provides type-safe database access with connection pooling and migration support. Environment-based configuration allows different settings per environment (dev/prod).

**Key Recommendations**:
- **Never use `synchronize: true` in production** - causes data loss
- Use connection pool settings: `max: 20`, `min: 2`, `idleTimeoutMillis: 30000`
- Implement connection retry with exponential backoff on startup
- Use `tsx` instead of `ts-node` for faster TypeScript execution in migrations

**Implementation**:
```typescript
// backend/src/config/database.ts
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_DATABASE || 'algojuke',

  poolSize: 10,
  extra: {
    max: 20, // Max pool clients
    min: 2,  // Min pool clients
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
  },

  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],

  synchronize: false, // CRITICAL: never true in production
  migrationsRun: process.env.NODE_ENV === 'production',
  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error'] : ['error'],
};
```

**Sources**:
- [A Comprehensive Guide to Database Pooling with PostgreSQL, TypeORM, and pgBouncer](https://blog.zysk.tech/a-comprehensive-guide-to-database-pooling-with-postgresql-typeorm-and-pgbouncer/)
- [TypeORM DataSource Documentation](https://typeorm.io/docs/data-source/data-source/)

---

## 2. Migration Strategy

### Decision: TypeORM CLI with tsx Runner

**Rationale**: TypeORM migrations provide version-controlled schema changes with rollback capability. Using `tsx` instead of `ts-node` provides 10x faster execution.

**Key Recommendations**:
- Use timestamp-based naming: `{timestamp}-{DescriptiveName}.ts`
- Always provide `down()` methods for rollbacks
- Test migrations on production-like data before deployment
- Never modify committed migrations - create new ones

**Implementation**:
```json
// backend/package.json scripts
{
  "scripts": {
    "typeorm": "tsx ./node_modules/typeorm/cli -d src/config/database.ts",
    "migration:generate": "npm run typeorm migration:generate",
    "migration:run": "npm run typeorm migration:run",
    "migration:revert": "npm run typeorm migration:revert"
  }
}
```

**Usage**:
```bash
# Generate migration from entity changes
npm run migration:generate src/migrations/CreateLibraryTables

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:revert
```

**Sources**:
- [Using TypeORM with TSX - A Smoother Development Experience](https://dev.to/osalumense/using-typeorm-with-tsx-a-smoother-development-experience-45n5)
- [TypeORM Migrations Documentation](https://typeorm.io/docs/advanced-topics/migrations/)

---

## 3. Entity Design for Music Library

### Decision: Separate Album/Track Entities with JSONB Metadata

**Rationale**: Albums and tracks are independent collections (per clarification Q1). JSONB columns provide flexible metadata storage while maintaining queryability.

**Key Recommendations**:
- Use B-tree indexes for text sorting (artist names, album/track titles)
- Use GIN indexes for JSONB columns (track listings, metadata)
- Create composite indexes for common sort patterns (artist + title)
- Use snake_case in database, camelCase in TypeScript (via naming strategy)

**Album Entity Pattern**:
```typescript
@Entity('albums')
@Index(['tidalAlbumId'], { unique: true }) // Prevent duplicates
@Index(['userId']) // Filter by user
export class LibraryAlbum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tidal_album_id', unique: true })
  tidalAlbumId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'artist_name', length: 255 })
  @Index() // For alphabetical sorting
  artistName: string;

  @Column({ type: 'jsonb', default: [] })
  trackListing: TrackInfo[]; // Cached from Tidal

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**Indexing Strategy**:
```sql
-- Composite index for sorting albums by artist then title
CREATE INDEX idx_library_albums_sort
ON library_albums (artist_name ASC, title ASC);

-- GIN index for JSONB track listing queries
CREATE INDEX idx_library_albums_tracks_gin
ON library_albums USING GIN (track_listing);
```

**Sources**:
- [PostgreSQL Indexing Best Practices Guide](https://www.mydbops.com/blog/postgresql-indexing-best-practices-guide/)
- [PostgreSQL and TypeORM Single Table Data](https://www.darraghoriordan.com/2022/06/11/persistence-3-typeorm-postgres-single-table-data)
- [TypeORM Decorator Reference](https://typeorm.io/docs/help/decorator-reference/)

---

## 4. GraphQL + TypeORM Integration

### Decision: Repository Pattern with Context Injection

**Rationale**: Separates database logic from resolvers, enables error handling centralization, maintains testability.

**Key Recommendations**:
- Pass TypeORM `DataSource` via Apollo Server context
- Wrap database operations in try/catch with error mapping
- Use DataLoader for N+1 query prevention (if needed)
- Validate inputs before database operations

**Resolver Pattern**:
```typescript
// Context with DataSource
export interface ResolverContext {
  tidalService: TidalService;
  dataSources: {
    db: DataSource;
  };
}

// Resolver with error handling
export const libraryResolvers = {
  Mutation: {
    addAlbumToLibrary: async (
      _parent: unknown,
      args: { tidalAlbumId: string },
      context: ResolverContext
    ): Promise<Album> => {
      try {
        const albumRepo = context.dataSources.db.getRepository(LibraryAlbum);

        // Check for duplicates
        const existing = await albumRepo.findOne({
          where: { tidalAlbumId: args.tidalAlbumId },
        });

        if (existing) {
          throw new GraphQLError('Album already in library', {
            extensions: { code: 'DUPLICATE_ENTRY' },
          });
        }

        // Fetch album data from Tidal (including track listing)
        const tidalData = await context.tidalService.getAlbumDetails(
          args.tidalAlbumId
        );

        // Save to database
        const album = await albumRepo.save(
          albumRepo.create({
            tidalAlbumId: args.tidalAlbumId,
            title: tidalData.title,
            artistName: tidalData.artistName,
            trackListing: tidalData.tracks, // Cache in JSONB
            // ... other fields
          })
        );

        return album;
      } catch (error) {
        throw DatabaseErrorHandler.handleError(error);
      }
    },
  },
};
```

**N+1 Query Prevention**:
- Use TypeORM `relations` for eager loading
- Implement DataLoader for complex nested queries
- Or use `@mando75/typeorm-graphql-loader` for automatic optimization

**Sources**:
- [A Guide to Apollo Server v4 with Express and TypeORM](https://medium.com/@christianhelgeson/a-guide-to-apollo-server-v4-with-express-and-typeorm-4226277c7a53)
- [Implementing server-side CRUD with TypeScript, TypeORM and GraphQL](https://codetain.com/blog/implementing-server-side-crud-with-typescript-typeorm-and-graphql/)
- [Solving the N+1 Problem with DataLoader](https://www.graphql-js.org/docs/n1-dataloader/)

---

## 5. Error Handling Strategy

### Decision: PostgreSQL Error Code Mapping with Retry Logic

**Rationale**: Maps database errors to user-friendly GraphQL errors, implements retry for transient failures (deadlocks, connection drops).

**Key Recommendations**:
- Map PostgreSQL error codes (23505 = unique violation, 40001 = serialization failure)
- Retry serialization failures and deadlocks automatically
- Never expose SQL queries or internal details in API responses
- Return HTTP 503 for retryable errors to signal client backoff

**Error Handler**:
```typescript
export class DatabaseErrorHandler {
  static handleError(error: unknown): DatabaseError {
    if (error instanceof QueryFailedError) {
      const pgError = error.driverError;

      switch (pgError.code) {
        case '23505': // Unique violation
          return new DatabaseError(
            'Item already exists in library',
            409,
            false // not retryable
          );

        case '40001': // Serialization failure
        case '40P01': // Deadlock
          return new DatabaseError(
            'Database conflict. Please retry.',
            503,
            true // retryable
          );

        default:
          return new DatabaseError(
            'Database operation failed',
            500,
            false
          );
      }
    }

    return new DatabaseError('Unknown error', 500, false);
  }
}
```

**Retry Strategy**:
```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || !DatabaseErrorHandler.isRetryable(error)) {
        throw error;
      }

      const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry failed');
}
```

**Sources**:
- [Advanced TypeORM Error Handling in NestJS](https://felixastner.com/articles/advanced-typeorm-error-handling-in-nestjs)
- [Error Handling - Apollo GraphQL Docs](https://www.apollographql.com/docs/apollo-server/data/errors)

---

## 6. Undo Functionality Implementation

### Decision: In-Memory Undo Buffer with Optimistic UI

**Rationale**: For 5-10 second undo windows, in-memory state is simpler and faster than soft delete. Aligns with clarification Q3 (post-removal undo with success message).

**Key Recommendations**:
- Use Map-based state to track multiple concurrent deletions
- Implement cleanup on component unmount (prevent memory leaks)
- Use Sonner toast library (lightweight, built for React 18, undo button support)
- Finalize deletion via API after timeout or manual close

**Implementation Pattern**:
```typescript
// Custom hook
export const useUndoDelete = (
  onFinalizeDelete: (id: string, type: 'album' | 'track') => Promise<void>,
  undoWindowMs: number = 10000
) => {
  const [deletedItems, setDeletedItems] = useState<Map<string, DeletedItem>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleDelete = useCallback((item: Album | Track) => {
    // Add to deleted items
    setDeletedItems(prev => new Map(prev).set(item.id, {
      item,
      timestamp: Date.now(),
      type: isAlbum(item) ? 'album' : 'track'
    }));

    // Start timeout
    const timeoutId = setTimeout(() => {
      finalizeDelete(item.id);
    }, undoWindowMs);

    timeoutsRef.current.set(item.id, timeoutId);

    // Show toast with undo button
    toast.success(`${item.title} removed`, {
      action: {
        label: 'Undo',
        onClick: () => handleUndo(item.id)
      },
      duration: undoWindowMs
    });
  }, [undoWindowMs]);

  const handleUndo = useCallback((itemId: string) => {
    const timeoutId = timeoutsRef.current.get(itemId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(itemId);
    }

    setDeletedItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });

    toast.success('Restored');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  return { handleDelete, handleUndo, isDeleted: (id) => deletedItems.has(id) };
};
```

**Toast Library: Sonner**
```bash
npm install sonner
```

**Why Sonner**:
- Lightweight (<5KB, zero dependencies)
- Built-in undo button support
- TypeScript-first
- Excellent animations
- Dark mode support

**Alternative**: React Toastify (more features, larger bundle)

**Sources**:
- [Create a timed undo feature capable of handling multiple simultaneous undos](https://medium.com/@1sebastian1sosa1/create-an-timed-undo-feature-capable-of-handling-simultaneous-undos-c4cc2121778)
- [Comparing the top React toast libraries [2025 update]](https://blog.logrocket.com/react-toast-libraries-compared-2025/)
- [How to Use the Optimistic UI Pattern with the useOptimistic() Hook in React](https://www.freecodecamp.org/news/how-to-use-the-optimistic-ui-pattern-with-the-useoptimistic-hook-in-react/)

**Rejected Alternative**: Soft delete with database flag
- Too complex for 5-10 second undo window
- Causes query complexity overhead
- Requires schema changes and unique constraint handling
- Overkill for UX requirement

---

## 7. Docker Compose for PostgreSQL

### Decision: Named Volume with Health Checks

**Rationale**: Named volumes provide best performance across platforms, health checks ensure database readiness before app connects.

**Configuration**:
```yaml
# docker-compose.yml (repository root)
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: algojuke-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-algojuke}
      POSTGRES_USER: ${POSTGRES_USER:-algojuke_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
    ports:
      - "${POSTGRES_PORT:-5433}:5432" # Map to 5433 to avoid local conflicts
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-algojuke_user}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - algojuke-network

volumes:
  postgres_data:
    driver: local

networks:
  algojuke-network:
    driver: bridge
```

**Environment Variables (.env)**:
```bash
# PostgreSQL Configuration
POSTGRES_DB=algojuke
POSTGRES_USER=algojuke_user
POSTGRES_PASSWORD=dev_password_change_in_production
POSTGRES_PORT=5433
POSTGRES_HOST=localhost

# Database Connection String
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
```

**Backup Strategy**:
```bash
# Create backup
docker-compose exec -T postgres pg_dump -U algojuke_user algojuke | gzip > backups/algojuke_$(date +%Y%m%d).sql.gz

# Restore backup
gunzip < backups/algojuke_20251228.sql.gz | docker-compose exec -T postgres psql -U algojuke_user algojuke
```

**Sources**:
- [Docker Compose for Node.js and PostgreSQL](https://michalzalecki.com/docker-compose-for-nodejs-and-postgresql/)
- [How to persist data in a dockerized postgres database using volumes?](https://dev.to/iamrj846/how-to-persist-data-in-a-dockerized-postgres-database-using-volumes-15f0)
- [Best Practices for Running PostgreSQL in Docker Containers](https://pankajconnect.medium.com/best-practices-for-running-postgresql-in-docker-containers-409c21dfb2cc)

---

## 8. Tidal API Track Listing Endpoint

### Decision: Fetch Album Items for Track Listings

**Current Implementation Analysis**:
- Existing `TidalService` fetches basic album metadata (title, artist, cover art, trackCount)
- Does NOT fetch detailed track listing (individual track titles, durations, positions)

**Required Enhancement**:
Add method to fetch album track listing from Tidal API:

```typescript
// Add to TidalService class
async getAlbumTrackListing(
  albumId: string,
  countryCode: string = 'US'
): Promise<TrackInfo[]> {
  const token = await this.tokenService.getValidToken();
  const url = `${this.apiBaseUrl}/v2/albums/${albumId}/relationships/items`;

  const response = await axios.get(url, {
    headers: {
      'accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${token}`,
    },
    params: {
      countryCode,
      include: 'items', // REQUIRED: includes track details in response
    },
    timeout: 5000,
  });

  // Transform JSON:API response to track listing
  return response.data.included
    .filter(item => item.type === 'tracks')
    .map((track, index) => ({
      position: index + 1,
      title: track.attributes.title,
      duration: track.attributes.duration, // Already in seconds from Tidal
      tidalId: track.id,
      explicit: track.attributes.explicit || false,
    }));
}
```

**Example Request**:
```http
GET /v2/albums/{albumId}/relationships/items?countryCode=US&include=items
Accept: application/vnd.api+json
Authorization: Bearer {token}
```

**Example Response Structure**:
```json
{
  "data": [
    {
      "id": "track-id",
      "type": "tracks",
      "relationships": { ... }
    }
  ],
  "included": [
    {
      "id": "track-id",
      "type": "tracks",
      "attributes": {
        "title": "Track Name",
        "duration": 245,
        "isrc": "USRC12345678",
        "explicit": false
      }
    }
  ]
}
```

**Cache Strategy**:
- Fetch track listing when adding album to library
- Store in JSONB `trackListing` column
- Never fetch again - library browsing works offline

**API Endpoint Details**:
- **Endpoint**: `/v2/albums/{albumId}/relationships/items`
- **Required Parameters**: `countryCode`, `include=items`
- **Response Format**: JSON:API with tracks in `included` array
- **Track Fields**: title, duration (seconds), isrc, explicit flag
- **OpenAPI Spec**: Available at `@tidal/tidal-api-oas.json`

**Sources**:
- Tidal API documentation
- Existing codebase analysis (`backend/src/services/tidalService.ts`)

---

## Summary of Key Decisions

| Decision Point | Choice | Rationale |
|----------------|--------|-----------|
| **ORM** | TypeORM | Type-safe, migrations, PostgreSQL-optimized |
| **Migration Tool** | TypeORM CLI + tsx | Faster than ts-node, integrated with ORM |
| **Entity Structure** | Separate Album/Track | Independent collections per requirements |
| **JSONB Storage** | Track listings, metadata | Queryable + flexible |
| **Indexes** | B-tree for text, GIN for JSONB | Optimal for alphabetical sorting |
| **Error Handling** | PostgreSQL code mapping + retry | User-friendly, resilient |
| **Undo Mechanism** | In-memory buffer | Simple, fast, fits 10s window |
| **Toast Library** | Sonner | Lightweight, React 18, undo support |
| **Local Database** | Docker Compose PostgreSQL | Standard development setup |
| **Connection Pooling** | max: 20, idle: 30s | Balanced performance/resources |

---

## Implementation Priorities

**Phase 0 Complete** ✅ - Research findings documented

**Phase 1 Next Steps**:
1. Create `data-model.md` with complete entity definitions
2. Create `contracts/library.graphql` with GraphQL schema
3. Create `quickstart.md` with local development setup
4. Update agent context files

**Phase 2 (Future)**:
- Generate `tasks.md` from user stories (via `/speckit.tasks`)
