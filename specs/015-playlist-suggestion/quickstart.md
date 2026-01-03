# Quickstart: Playlist Suggestion Agent Tool

**Feature**: 015-playlist-suggestion
**Date**: 2026-01-02

## Prerequisites

1. **Running services** (from project root):
   ```bash
   docker compose up -d  # Starts PostgreSQL, Qdrant, Inngest, Langfuse
   ```

2. **Environment variables** in `.env`:
   ```bash
   TIDAL_CLIENT_ID=<your-tidal-client-id>
   TIDAL_CLIENT_SECRET=<your-tidal-client-secret>
   ANTHROPIC_API_KEY=<your-anthropic-api-key>
   ```

3. **Dependencies installed**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

---

## Development Workflow

### 1. Start Backend

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:4000`.

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 3. Open Chat Interface

Navigate to `http://localhost:5173/discover/chat` to access the chat interface.

---

## Testing the Playlist Tool

### Manual Testing via Chat

1. **Open a new conversation** in the chat interface
2. **Ask for a playlist**:
   ```
   Create a workout playlist with 5 high-energy tracks
   ```
3. **Observe**:
   - "Building playlist..." indicator appears
   - Playlist card renders with album artwork
   - Click on tracks to expand reasoning

### Testing with Specific ISRCs

To test with known ISRCs (for predictable results):

```
Create a playlist called "Test Mix" with these tracks:
- "Lose Yourself" by Eminem (USRC12400180)
- "Can't Hold Us" by Macklemore & Ryan Lewis (USEE11201028)
- "Stronger" by Kanye West (USUM70745091)
```

### Testing Partial Enrichment

Use ISRCs that don't exist on Tidal to test fallback:

```
Create a playlist with:
- "Real Track" by Real Artist (USRC12400180) - should enrich
- "Fake Track" by Fake Artist (ZZUN99999999) - should fallback
```

---

## Running Tests

### Backend Tests

```bash
cd backend

# All tests
npm test

# Specific tool tests
npm test -- tests/contract/agentTools/suggestPlaylistTool.test.ts

# Watch mode
npm run test:watch
```

### Frontend Tests

```bash
cd frontend

# All tests
npm test

# Specific component tests
npm test -- src/components/chat/PlaylistCard.test.tsx

# Watch mode
npm run test:watch
```

### Type Checking

```bash
# Backend
cd backend && npm run type-check

# Frontend
cd frontend && npm run type-check
```

---

## Key Files

### Backend

| File | Description |
|------|-------------|
| `backend/src/schemas/agentTools.ts` | `SuggestPlaylistInputSchema` Zod schema |
| `backend/src/types/agentTools.ts` | `SuggestPlaylistOutput`, `EnrichedPlaylistTrack` types |
| `backend/src/services/agentTools/suggestPlaylistTool.ts` | Tool implementation |
| `backend/src/services/chatStreamService.ts` | Tool registration (line ~600) |
| `backend/src/prompts/chatSystemPrompt.ts` | Agent tool description |
| `backend/src/services/tidalService.ts` | Batch tracks/albums methods |

### Frontend

| File | Description |
|------|-------------|
| `frontend/src/components/chat/PlaylistCard.tsx` | Playlist display component |
| `frontend/src/components/chat/PlaylistCard.css` | Styles |
| `frontend/src/components/chat/ToolInvocation.tsx` | Handles `suggestPlaylist` rendering |
| `frontend/src/hooks/useChatStream.ts` | SSE event handling |

---

## Observability

### Langfuse Dashboard

Access at `http://localhost:3000` (login: `admin@localhost.dev` / `adminadmin`).

**Filter traces**:
- Project: `algojuke`
- Span name contains: `suggestPlaylist`

**Observe**:
- Input: Playlist title, track count, ISRCs
- Output: Enriched track count, failed count
- Duration: Total enrichment time
- Child spans: Individual Tidal API calls

### Backend Logs

```bash
# Watch logs for playlist tool
docker compose logs -f backend 2>&1 | grep suggest_playlist
```

Log events:
- `suggest_playlist_start` - Tool invoked
- `suggest_playlist_tracks_batch` - Tidal tracks API call
- `suggest_playlist_albums_batch` - Tidal albums API call
- `suggest_playlist_complete` - Enrichment finished

---

## Common Issues

### "Building playlist..." hangs indefinitely

1. Check backend logs for Tidal API errors
2. Verify Tidal credentials in `.env`
3. Check rate limiter isn't blocking (default: 2 req/s)

### Placeholder images instead of artwork

1. Normal for tracks not found on Tidal
2. Check `enriched: false` in tool output
3. Verify ISRC format (12 alphanumeric characters)

### SSE connection drops

1. Check browser DevTools → Network → filter EventStream
2. Look for 499/502 errors
3. Restart backend if connection stale

### Tests fail with "Cannot find module"

```bash
# Rebuild TypeScript
cd backend && npm run build

# Or run with tsx directly
npx tsx --test
```

---

## Debugging Tips

### Inspect SSE Events

In browser DevTools:
1. Network tab → Filter: `EventStream`
2. Click on `stream` request
3. EventStream tab shows raw SSE events

### Log Tool Input/Output

Add temporary logging in `chatStreamService.ts`:

```typescript
// In suggestPlaylist tool execute function
console.log('Playlist input:', JSON.stringify(input, null, 2));

// After enrichment
console.log('Playlist output:', JSON.stringify(result, null, 2));
```

### Test Tidal API Directly

```bash
# Get token (requires jq)
TOKEN=$(curl -s -X POST https://auth.tidal.com/v1/oauth2/token \
  -d "client_id=$TIDAL_CLIENT_ID" \
  -d "client_secret=$TIDAL_CLIENT_SECRET" \
  -d "grant_type=client_credentials" | jq -r .access_token)

# Fetch track by ISRC
curl "https://openapi.tidal.com/v2/tracks?filter[isrc]=USRC12400180&countryCode=US" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.api+json"
```

---

## Next Steps

After implementation:

1. **Run full test suite**: `npm test` in both backend and frontend
2. **Manual testing**: Try various playlist sizes (1, 10, 50 tracks)
3. **Test edge cases**: Invalid ISRCs, Tidal API errors, empty results
4. **Review traces**: Check Langfuse for performance and errors
5. **Update documentation**: Add to CLAUDE.md agent tools section
