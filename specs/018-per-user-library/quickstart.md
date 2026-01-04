# Quickstart: Per-User Music Library Storage

**Feature**: 018-per-user-library
**Date**: 2026-01-04

## Prerequisites

- Node.js 20.x
- PostgreSQL running (via Docker Compose)
- Clerk account configured with Google OAuth
- Environment variables set (see below)

## Environment Setup

Ensure these environment variables are configured:

```bash
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/algojuke
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Frontend (.env)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Database Migration

### 1. Generate Migration (if not already created)

The migration file should be created at:
`backend/src/migrations/1736000000000-EnableMultiUserLibrary.ts`

### 2. Run Migration

```bash
cd backend
npm run migration:run
```

This will:
1. Update existing library and conversation records to use the Clerk userId for anton.tcholakov@gmail.com
2. Drop global unique constraints on tidal_album_id and tidal_track_id
3. Create composite unique constraints on (tidal_album_id, user_id) and (tidal_track_id, user_id)

### 3. Verify Migration

```bash
# Check constraints
psql $DATABASE_URL -c "\d library_albums"
psql $DATABASE_URL -c "\d library_tracks"

# Verify data
psql $DATABASE_URL -c "SELECT COUNT(*), user_id FROM library_albums GROUP BY user_id"
psql $DATABASE_URL -c "SELECT COUNT(*), user_id FROM conversations GROUP BY user_id"
```

## Testing the Feature

### 1. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Authentication Flow

1. Navigate to http://localhost:5173
2. Sign in with Google (anton.tcholakov@gmail.com)
3. Complete Tidal OAuth connection
4. Access the Library section

### 3. Verify User Isolation

With the approved user signed in:
1. Add an album to library
2. Verify it appears in Albums view
3. Check GraphQL response includes correct userId

### 4. Verify Auth Enforcement

Test unauthenticated access:
```bash
# Should return UNAUTHENTICATED error
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ getLibraryAlbums { id title } }"}'
```

Expected response:
```json
{
  "errors": [{
    "message": "Authentication required",
    "extensions": { "code": "UNAUTHENTICATED" }
  }]
}
```

## Running Tests

### Unit/Contract Tests

```bash
cd backend
npm test
```

### Specific Test Suites

```bash
# Auth enforcement tests
npm test -- tests/contract/auth/graphqlAuth.test.ts

# User isolation tests
npm test -- tests/contract/library/userIsolation.test.ts

# Integration tests
npm test -- tests/integration/multiUser/libraryIsolation.test.ts
```

## Troubleshooting

### Migration Fails

If the migration fails with constraint violation:

1. Check for duplicate tidal_album_id entries:
   ```sql
   SELECT tidal_album_id, COUNT(*)
   FROM library_albums
   GROUP BY tidal_album_id
   HAVING COUNT(*) > 1;
   ```

2. If duplicates exist, they need manual resolution before migration

### Auth Errors in GraphQL

If getting UNAUTHENTICATED errors when signed in:

1. Check Clerk middleware is running:
   ```typescript
   // server.ts should have clerkMiddleware applied
   app.use(clerkMiddleware());
   ```

2. Verify auth header is being sent:
   ```javascript
   // Browser console
   console.log(localStorage.getItem('__clerk_client_jwt'));
   ```

3. Check server context extraction:
   ```typescript
   // In server.ts context function
   console.log('Auth:', getAuth(req));
   ```

### User Data Not Appearing

If library items or conversations aren't showing:

1. Verify userId in database matches Clerk userId:
   ```sql
   SELECT user_id FROM library_albums LIMIT 1;
   SELECT user_id FROM conversations LIMIT 1;
   ```

2. Compare with Clerk userId (from dashboard or API)

3. Ensure migration ran successfully for data association

## Security Verification

### Verify Cross-User Protection

1. Note an album ID from the database
2. Create a test with a different userId trying to access it:
   ```typescript
   // Should return null, not the album
   const result = await libraryService.getLibraryAlbum(albumId, 'different-user-id');
   expect(result).toBeNull();
   ```

### Check Security Logs

Monitor for ACCESS_VIOLATION events:
```bash
# In backend logs
grep "ACCESS_VIOLATION" logs/*.log
```

## Rollback Procedure

If rollback is needed:

```bash
cd backend
npm run migration:revert
```

**Warning**: Rollback will restore global unique constraints. If multiple users have added the same album/track, the rollback will fail.

## Next Steps

After successful deployment:

1. Monitor security logs for any access violations
2. Verify performance metrics match targets (<2s library browse)
3. Test with additional approved users (add to allowlist)
