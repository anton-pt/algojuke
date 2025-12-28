# Quick Start: Library Management Development

**Feature**: 002-library-management
**Date**: 2025-12-28

This guide helps you set up the local development environment for the music library management feature.

---

## Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- Tidal API credentials
- Completed 001-tidal-search feature setup

---

## 1. Start PostgreSQL Database

### Create docker-compose.yml (if not exists)

Create `docker-compose.yml` in the repository root:

```yaml
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
      - "${POSTGRES_PORT:-5433}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-algojuke_user}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - algojuke-network

volumes:
  postgres_data:

networks:
  algojuke-network:
    driver: bridge
```

### Start Database

```bash
# Start PostgreSQL
docker-compose up -d postgres

# View logs
docker-compose logs -f postgres

# Verify database is ready
docker-compose exec postgres pg_isready -U algojuke_user
```

---

## 2. Configure Environment Variables

### Update backend/.env

Add these lines to `backend/.env`:

```bash
# PostgreSQL Configuration
POSTGRES_DB=algojuke
POSTGRES_USER=algojuke_user
POSTGRES_PASSWORD=dev_password_change_in_production
POSTGRES_PORT=5433
POSTGRES_HOST=localhost

# Database Connection
DATABASE_URL=postgresql://algojuke_user:dev_password_change_in_production@localhost:5433/algojuke

# TypeORM Settings (development only)
DB_LOGGING=true
DB_SYNCHRONIZE=false
DB_SLOW_QUERY_THRESHOLD=1000
```

### Update backend/.env.example

Add the same variables (with placeholder values) to `.env.example` for documentation.

---

## 3. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install typeorm pg reflect-metadata typeorm-naming-strategies tsx
npm install --save-dev @types/pg

# Return to root
cd ..
```

---

## 4. Run Migrations

After implementing the entities and migrations:

```bash
cd backend

# Run pending migrations
npm run migration:run

# Verify tables created
docker-compose exec postgres psql -U algojuke_user -d algojuke -c "\dt"
# Should show: library_albums, library_tracks, migrations
```

---

## 5. Start Development Servers

```bash
# Terminal 1: Backend with hot reload
cd backend
npm run dev

# Terminal 2: Frontend with hot reload
cd frontend
npm run dev
```

Access:
- **Frontend**: http://localhost:5173
- **GraphQL API**: http://localhost:4000/graphql

---

## 6. Test Library Operations

### GraphQL Playground

Navigate to http://localhost:4000/graphql

**Add Album to Library**:
```graphql
mutation {
  addAlbumToLibrary(input: { tidalAlbumId: "123456" }) {
    ... on LibraryAlbum {
      id
      title
      artistName
      trackListing {
        position
        title
        duration
      }
    }
    ... on DuplicateLibraryItemError {
      message
      existingItemId
    }
    ... on TidalApiUnavailableError {
      message
      retryable
    }
  }
}
```

**Get Library Albums**:
```graphql
query {
  getLibraryAlbums {
    id
    title
    artistName
    trackCount
    createdAt
  }
}
```

**Remove Album**:
```graphql
mutation {
  removeAlbumFromLibrary(id: "uuid-here")
}
```

---

## 7. Database Management

### Connect to PostgreSQL

```bash
# Using psql
docker-compose exec postgres psql -U algojuke_user -d algojuke

# Or from host (requires psql installed)
psql -h localhost -p 5433 -U algojuke_user -d algojuke
```

### Common SQL Queries

```sql
-- View all albums in library
SELECT id, title, artist_name, track_count, created_at
FROM library_albums
ORDER BY artist_name, title;

-- View all tracks in library
SELECT id, title, artist_name, album_name, duration, created_at
FROM library_tracks
ORDER BY artist_name, title;

-- Count library items
SELECT
  (SELECT COUNT(*) FROM library_albums) as album_count,
  (SELECT COUNT(*) FROM library_tracks) as track_count;

-- View album with track listing
SELECT title, artist_name, track_listing
FROM library_albums
WHERE id = 'uuid-here';
```

### Backup Database

```bash
# Create backup
docker-compose exec -T postgres pg_dump -U algojuke_user algojuke > backups/algojuke_$(date +%Y%m%d).sql

# Restore backup
docker-compose exec -T postgres psql -U algojuke_user -d algojuke < backups/algojuke_20251228.sql
```

### Reset Database

```bash
# Drop all tables and re-run migrations
cd backend
npm run migration:revert  # Revert all migrations
npm run migration:run     # Re-apply migrations
```

---

## 8. Running Tests

```bash
# Backend tests
cd backend
npm test                    # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage

# Frontend tests
cd frontend
npm test
npm run test:watch
npm run test:coverage
```

---

## 9. Troubleshooting

### Database Connection Errors

**Error**: `ECONNREFUSED 127.0.0.1:5433`

**Solution**:
```bash
# Check if PostgreSQL is running
docker-compose ps

# Start if not running
docker-compose up -d postgres

# View logs for errors
docker-compose logs postgres
```

### Port Already in Use

**Error**: `port 5433 already allocated`

**Solution**:
```bash
# Change port in .env
POSTGRES_PORT=5434

# Restart containers
docker-compose down
docker-compose up -d
```

### Migration Errors

**Error**: `relation "library_albums" already exists`

**Solution**:
```bash
# Check migration status
cd backend
npm run migration:show

# If table exists but migration not recorded:
docker-compose exec postgres psql -U algojuke_user -d algojuke

# In psql:
DROP TABLE IF EXISTS library_albums CASCADE;
DROP TABLE IF EXISTS library_tracks CASCADE;
\q

# Re-run migrations
npm run migration:run
```

### Tidal API Errors

**Error**: `TidalApiUnavailableError: Authentication failed`

**Solution**:
```bash
# Verify Tidal credentials in backend/.env
# TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET must be valid

# Test Tidal connection
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ search(query: \"test\") { albums { title } } }"}'
```

---

## 10. Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v

# Stop but keep data
docker-compose stop
```

---

## Next Steps

1. Implement backend entities (`backend/src/entities/`)
2. Create migrations (`backend/src/migrations/`)
3. Implement GraphQL resolvers (`backend/src/resolvers/library.ts`)
4. Implement library service (`backend/src/services/library.ts`)
5. Create frontend library views (`frontend/src/components/library/`)
6. Implement undo functionality (`frontend/src/hooks/useUndoDelete.ts`)
7. Run tests and verify all user stories pass

---

## Useful Commands Reference

```bash
# Docker Compose
docker-compose up -d postgres        # Start database
docker-compose logs -f postgres      # View logs
docker-compose down                  # Stop all services
docker-compose ps                    # Check status

# Database
psql -h localhost -p 5433 -U algojuke_user -d algojuke  # Connect
\dt                                  # List tables
\d library_albums                    # Describe table
\q                                   # Quit psql

# Migrations
npm run migration:generate src/migrations/NAME  # Generate
npm run migration:run                          # Run
npm run migration:revert                       # Revert
npm run migration:show                         # Show status

# Development
npm run dev        # Start backend with hot reload
npm run build      # Build for production
npm test           # Run tests
npm run lint       # Lint code
```

---

## Resources

- [TypeORM Documentation](https://typeorm.io/)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

For detailed implementation guides, see:
- [research.md](./research.md) - Research findings and best practices
- [data-model.md](./data-model.md) - Entity definitions and schemas
- [contracts/library.graphql](./contracts/library.graphql) - GraphQL API contract
