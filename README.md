# AlgoJuke

AlgoJuke is an algorithmic jukebox designed to help you discover new music
fitting to your music tastes and current mood. It creates playlists which tell
a story using the lyrics to help you connect with your music more deeply.

You can manage your library of familiar music. It creates playlists based on
natural language input and/or anchor tracks, along with an explore/exploit
setting determining how much of the music comes from your own library.

## Current Features

### Tidal Music Search (Feature 001)

Search for albums and tracks on Tidal with album artwork display.

**Tech Stack:**
- Frontend: React 18+ with TypeScript, Vite, Apollo Client
- Backend: Node.js 20.x with TypeScript, Apollo Server 4.x, axios
- Testing: Vitest + React Testing Library

**Performance:**
- ⚡ **~2 second** search response time (with batch API optimization)
- 🚀 **7x faster** than naive approach (3 API calls vs 41 calls for 20 albums)
- 📊 Supports 100+ concurrent users with in-memory caching

**Getting Started:**

1. **Prerequisites**:
   - Node.js 20.x or higher
   - Tidal API credentials ([Get them here](https://developer.tidal.com))

2. **Environment Setup**:
   ```bash
   # Copy environment template
   cp backend/.env.example backend/.env

   # Edit backend/.env and add your Tidal API credentials:
   # TIDAL_CLIENT_ID=your_client_id_here
   # TIDAL_CLIENT_SECRET=your_client_secret_here
   ```

3. **Install Dependencies**:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   cd ..
   ```

4. **Development Mode**:
   ```bash
   # Terminal 1: Start backend dev server (with hot reload)
   cd backend
   npm run dev

   # Terminal 2: Start frontend dev server (with hot reload)
   cd frontend
   npm run dev
   ```

   Access the application:
   - **Frontend**: http://localhost:5173
   - **GraphQL API**: http://localhost:4000/graphql

5. **Testing**:
   ```bash
   # Run backend tests
   cd backend
   npm test                    # Run tests once
   npm run test:watch          # Run tests in watch mode
   npm run test:coverage       # Run with coverage report

   # Run frontend tests
   cd frontend
   npm test                    # Run tests once
   npm run test:watch          # Run tests in watch mode
   npm run test:coverage       # Run with coverage report
   ```

6. **Linting**:
   ```bash
   # Lint backend code
   cd backend && npm run lint

   # Lint frontend code
   cd frontend && npm run lint
   ```

For detailed API documentation and architecture, see `specs/001-tidal-search/`

## Batch API Optimization

The search implementation uses an optimized 3-call pattern to minimize API requests:

### How It Works

**Step 1: Initial Search**
```
GET /v2/searchResults/{query}?include=albums,tracks
```
Returns basic album and track data (no artist names or cover art)

**Step 2: Batch Track Details** (if tracks found)
```
GET /v2/tracks?filter[isrc]={isrc1},{isrc2},...&include=albums
```
Fetches album associations for all tracks in one request

**Step 3: Batch Album Details** (chunked to 20 albums max)
```
GET /v2/albums?filter[id]={id1},{id2},...&include=artists,coverArt
```
Fetches all artist names and cover art in batch requests (max 20 per request)

### Performance Comparison

| Albums | Old Approach | New Approach | Improvement |
|--------|-------------|--------------|-------------|
| 10     | 21 calls (~10s) | 3 calls (~2s) | **5x faster** |
| 20     | 41 calls (~20s) | 3-4 calls (~2s) | **7x faster** |
| 25     | 51 calls (~25s) | 4 calls (~3s) | **8x faster** |

### Configuration

Rate limiting is configured in `backend/.env`:
```bash
TIDAL_REQUESTS_PER_SECOND=3  # Safe with batch optimization
TIDAL_MAX_CONCURRENT=3       # Parallel request limit
TIDAL_MAX_RETRIES=3          # Retry failed requests
TIDAL_RETRY_DELAY_MS=1000    # Delay between retries
```

## Deployment

### Production Build

```bash
# Build backend
cd backend
npm run build       # Compiles TypeScript to dist/

# Build frontend
cd frontend
npm run build       # Builds optimized bundle to dist/
```

### Environment Variables

Required environment variables for production:

**Backend (`backend/.env`):**
```bash
# Tidal API Credentials (REQUIRED)
TIDAL_CLIENT_ID=your_client_id_here
TIDAL_CLIENT_SECRET=your_client_secret_here

# Tidal API Configuration
TIDAL_TOKEN_URL=https://auth.tidal.com/v1/oauth2/token
TIDAL_API_BASE_URL=https://openapi.tidal.com

# Rate Limiting (adjust based on your Tidal API tier)
TIDAL_REQUESTS_PER_SECOND=3
TIDAL_MAX_CONCURRENT=3
TIDAL_MAX_RETRIES=3
TIDAL_RETRY_DELAY_MS=1000

# Cache Configuration (TTL in seconds)
SEARCH_CACHE_TTL=3600

# Server Configuration
PORT=4000
NODE_ENV=production
```

### Running in Production

**Backend:**
```bash
cd backend
npm run build
npm start           # Runs node dist/server.js
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview     # Preview production build locally

# Or serve dist/ with your preferred static file server:
# - nginx
# - Apache
# - Vercel/Netlify
# - CloudFlare Pages
```

### Health Checks

The GraphQL endpoint (`/graphql`) can be used for health checks:
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

Expected response: `{"data":{"__typename":"Query"}}`

### Monitoring

Monitor these metrics in production:
- **Response time**: Should be <3s for searches (SC-001)
- **Error rate**: Should be <10% (SC-003)
- **Cache hit rate**: Check logs for `cache_hit` vs `search_request`
- **Rate limit errors**: 429 responses indicate rate limit issues

## Project Structure

```
algojuke/
├── backend/          # GraphQL API server
├── frontend/         # React web application
└── specs/            # Feature specifications and design docs
```

## Browser Support

Chrome 91+, Firefox 89+, Safari 14+, Edge 91+ (ES2020 support required)

Happy listening!
