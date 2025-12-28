# Phase 0 Research: Tidal API Integration

**Date**: 2025-12-27 (Updated after implementation findings)
**Feature**: Tidal Music Search Application
**Research Scope**: Tidal API v2 specifics, authentication, search capabilities, and album artwork

---

## CRITICAL UPDATE - TIDAL API v2 FINDINGS

**Implementation Discovery**: During initial implementation, we discovered that the public Tidal API has changed significantly from community documentation. The official API uses **v2 endpoints** with **JSON:API specification**, not the v1 REST endpoints previously documented by the community.

### What Changed from Initial Research
- ❌ **OLD**: `https://api.tidal.com/v1/search` (NOT for external use)
- ✅ **NEW**: `https://openapi.tidal.com/v2/searchResults/{query}` (official external API)
- ❌ **OLD**: Custom JSON response format
- ✅ **NEW**: JSON:API specification format (https://jsonapi.org/)
- ❌ **OLD**: `application/vnd.tidal.v1+json` content type
- ✅ **NEW**: `application/vnd.api+json` content type

---

## TIDAL API v2 OVERVIEW

### API Endpoint Base URLs

**IMPORTANT**: Tidal has TWO separate API bases:
- **Internal API** (NOT FOR EXTERNAL USE): `https://api.tidal.com/v1/`
  - Used by Tidal's own apps
  - Returns 401 Unauthorized for external developers
  - Community docs reference this (incorrectly for external use)

- **External Developer API** (OFFICIAL): `https://openapi.tidal.com/`
  - v2 endpoints for external developers
  - Requires developer credentials
  - Uses JSON:API specification
  - **THIS IS WHAT WE USE**

### Official Documentation
- **Developer Portal**: https://developer.tidal.com
- **API Reference**: https://developer.tidal.com/apiref
- **Documentation**: https://developer.tidal.com/documentation/api-sdk
- **Status**: Official, but access to some docs requires developer account

### GitHub Resources
- **Official GitHub**: https://github.com/orgs/tidal-music
- **API Reference**: https://tidal-music.github.io/tidal-api-reference/
- **Discussions**: https://github.com/orgs/tidal-music/discussions
  - Discussion #38: Confirms `api.tidal.com` is NOT for external use
  - Discussion #78: Scope limitations and available endpoints

---

## AUTHENTICATION & API ACCESS

### Authentication Flow (VERIFIED WORKING)

**Method**: OAuth 2.0 Client Credentials Flow

**Token Endpoint**:
```
POST https://auth.tidal.com/v1/oauth2/token
```

**Request Headers**:
```
Content-Type: application/x-www-form-urlencoded
```

**Request Body**:
```
grant_type=client_credentials
client_id={YOUR_CLIENT_ID}
client_secret={YOUR_CLIENT_SECRET}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUz...",
  "token_type": "Bearer",
  "expires_in": 14400
}
```

**Token Expiration**: 4 hours (14400 seconds)

### Required Headers for API Requests

```
accept: application/vnd.api+json
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/vnd.api+json
```

**Note**: The `X-Tidal-Token` header mentioned in community docs is **NOT required** for v2 API.

### Environment Variables (VERIFIED)

```bash
TIDAL_CLIENT_ID=your_client_id_from_developer_portal
TIDAL_CLIENT_SECRET=your_client_secret_from_developer_portal
TIDAL_TOKEN_URL=https://auth.tidal.com/v1/oauth2/token
TIDAL_API_BASE_URL=https://openapi.tidal.com
```

### Obtaining Credentials

1. Visit https://developer.tidal.com
2. Create a developer account
3. Create an application
4. Receive Client ID and Client Secret
5. Store credentials in `.env` file (NEVER commit to version control)

---

## SEARCH ENDPOINTS (v2 API)

### Primary Search Endpoint (VERIFIED WORKING)

```
GET https://openapi.tidal.com/v2/searchResults/{query}
```

**Path Parameters**:
- `query`: The search term (URL-encoded)

**Query Parameters**:

| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `countryCode` | string | NO | US | ISO 3166-1 country code |
| `explicitFilter` | string | NO | INCLUDE | INCLUDE, EXCLUDE, or EXCLUSIVE |
| `include` | string | NO | - | Comma-separated resource types to include in response |
| `limit` | integer | NO | 20 | Max results per type |

**Supported Include Types**:
- `albums` - Album resources
- `tracks` - Track/song resources
- `artists` - Artist resources (separate endpoint calls required for full data)
- `playlists` - Playlist resources
- `videos` - Video resources

**Example Request**:
```bash
curl -X 'GET' \
  'https://openapi.tidal.com/v2/searchResults/beatles?explicitFilter=INCLUDE&countryCode=US&include=albums,tracks' \
  -H 'accept: application/vnd.api+json' \
  -H 'Authorization: Bearer {token}'
```

### Response Structure (JSON:API Format)

The response follows JSON:API specification with `data`, `included`, `relationships`, and `links`:

```json
{
  "data": {
    "id": "beatles",
    "type": "searchResults",
    "attributes": {
      "trackingId": "uuid-here"
    },
    "relationships": {
      "albums": {
        "data": [
          { "id": "71073722", "type": "albums" },
          { "id": "129596083", "type": "albums" }
        ],
        "links": {
          "self": "/searchResults/beatles/relationships/albums?...",
          "next": "/searchResults/beatles/relationships/albums?page[cursor]=...",
          "meta": {
            "nextCursor": "cursor_value"
          }
        }
      },
      "tracks": {
        "data": [
          { "id": "track_id", "type": "tracks" }
        ],
        "links": {
          "self": "/searchResults/beatles/relationships/tracks?..."
        }
      }
    }
  },
  "included": [
    {
      "id": "71073722",
      "type": "albums",
      "attributes": {
        "title": "Heartworms",
        "explicit": false,
        "numberOfItems": 11,
        "duration": "PT41M49S",
        "releaseDate": "2017-03-10",
        "popularity": 0.586,
        "externalLinks": [
          {
            "href": "https://tidal.com/browse/album/71073722",
            "meta": { "type": "TIDAL_SHARING" }
          }
        ],
        "mediaTags": ["HIRES_LOSSLESS", "LOSSLESS"],
        "barcodeId": "886446308050",
        "copyright": { "text": "(P) 2017 Sony Music" }
      },
      "relationships": {
        "artists": {
          "links": {
            "self": "/albums/71073722/relationships/artists?countryCode=US"
          }
        },
        "coverArt": {
          "links": {
            "self": "/albums/71073722/relationships/coverArt?countryCode=US"
          }
        }
      }
    }
  ],
  "links": {
    "self": "/searchResults/beatles?include=albums&countryCode=US&explicitFilter=INCLUDE"
  }
}
```

### Key Response Features

**Duration Format**: ISO 8601 duration (e.g., `"PT41M49S"` = 41 minutes 49 seconds)
- Parse pattern: `PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?`
- Convert to seconds for UI display

**Pagination**: Cursor-based, not offset-based
- Use `links.next` and `meta.nextCursor` for pagination
- Traditional offset pagination not supported in v2

**Relationships**: Data references that require additional API calls
- Artist names: Must fetch from `/albums/{id}/relationships/artists`
- Cover art: Must fetch from `/albums/{id}/relationships/coverArt`
- **Limitation**: Initial search does NOT include full artist/artwork data

---

## ALBUM ARTWORK / IMAGES

### Current Limitation (IMPORTANT)

The v2 search API returns artwork URLs through **relationship links**, not directly in attributes:

```json
"relationships": {
  "coverArt": {
    "links": {
      "self": "/albums/{id}/relationships/coverArt?countryCode=US"
    }
  }
}
```

To get actual cover images, you must:
1. Perform search to get album IDs
2. Make additional request to `/albums/{id}/relationships/coverArt`
3. Parse the cover art resource

### Workaround Implemented

**Current approach**: Use placeholder images until artwork fetching is implemented
- Placeholder SVG for all results
- Maintains acceptable UX while reducing API calls
- Future enhancement: Implement batch artwork fetching

### Image URL Format (From CoverArt Endpoint)

Once fetched, cover art follows the pattern:
```
https://resources.tidal.com/images/{uuid}/{width}x{height}.jpg
```

**Recommended Sizes**:
- Thumbnail: 160x160
- Standard: 320x320
- Detail: 640x640
- High-res: 1280x1280

---

## ARTIST INFORMATION

### Current Limitation

Similar to artwork, artist names are in relationships:

```json
"relationships": {
  "artists": {
    "links": {
      "self": "/albums/{id}/relationships/artists?countryCode=US"
    }
  }
}
```

### Workaround Implemented

**Current approach**: Display "Unknown Artist" placeholder
- Maintains functional search
- Future enhancement: Batch fetch artist data

### Future Enhancement

To get artist names:
1. Extract artist relationship links from albums/tracks
2. Make batch request to artist endpoints
3. Map artist IDs to names
4. Update UI with actual artist information

---

## IMPLEMENTATION FINDINGS

### What Works ✅

1. **OAuth Token Acquisition**: Client credentials flow works reliably
   - 4-hour token expiration
   - Auto-refresh implemented with 5-minute buffer

2. **Search Endpoint**: `/v2/searchResults/{query}` returns results
   - Albums included when requested
   - Tracks included when requested
   - JSON:API format parsed successfully

3. **Album Metadata**: Rich data available
   - Title, release date, track count
   - Duration (ISO 8601 format)
   - Explicit flag
   - External links (Tidal website URLs)
   - Media quality tags

4. **Special Characters**: Full UTF-8 support confirmed
   - Tested: "AC/DC", "Beyoncé", international characters
   - URL encoding handles all cases

### Current Limitations ⚠️

1. **Artist Names**: Require additional API calls
   - Not included in search response `included` array
   - Must fetch from relationship endpoints
   - **Status**: Using "Unknown Artist" placeholder

2. **Cover Artwork**: Require additional API calls
   - Not included in search response `included` array
   - Must fetch from relationship endpoints
   - **Status**: Using placeholder SVG images

3. **Total Result Counts**: Not readily available
   - v2 API uses cursor pagination
   - No `totalNumberOfItems` in response
   - **Status**: Using returned result count as approximate total

4. **Track-Album Association**: Requires relationship parsing
   - Track responses don't include album title directly
   - Must correlate via relationship IDs
   - **Status**: Using empty strings for album info on tracks

### Performance Characteristics

**Measured Latency** (from implementation testing):
- Token acquisition: ~700-900ms (cached for 4 hours)
- Search query: ~350-450ms
- Total first search: ~1.2-1.4 seconds
- Cached search: <50ms (GraphQL cache)

**Rate Limiting** (observed):
- No 429 errors encountered during testing
- Successful with ~5-10 requests per minute
- Conservative approach: implement caching to minimize calls

---

## BEST PRACTICES (VERIFIED)

### 1. Token Management ✅ IMPLEMENTED

```typescript
class TidalTokenService {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  async getValidToken(): Promise<string> {
    // Check if cached token valid (with 5-minute buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      return this.cachedToken.token;
    }
    // Fetch new token
    const token = await this.fetchNewToken();
    this.cachedToken = {
      token,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000 // 4 hours
    };
    return token;
  }
}
```

### 2. Search Caching ✅ IMPLEMENTED

```typescript
// Cache search results for 1 hour
const cacheKey = `search:${query}:${countryCode}:${limit}`;
const cachedResult = cache.get(cacheKey);
if (cachedResult) {
  return { ...cachedResult, cached: true };
}
// ... fetch from API ...
cache.set(cacheKey, results, 3600); // 1 hour TTL
```

### 3. Response Transformation ✅ IMPLEMENTED

```typescript
private transformV2Response(response: TidalV2SearchResponse): SearchResults {
  const included = response.included || [];

  // Filter albums from included resources
  const albumResources = included.filter(r => r.type === 'albums');

  // Transform to GraphQL format
  const albums = albumResources.map(album => ({
    id: album.id,
    title: album.attributes.title,
    duration: parseDuration(album.attributes.duration), // ISO 8601 -> seconds
    // ... other fields
  }));

  return { albums, tracks, total, query, cached: false, timestamp: Date.now() };
}
```

### 4. ISO 8601 Duration Parsing ✅ IMPLEMENTED

```typescript
function parseDuration(iso: string): number {
  // "PT41M49S" -> 2509 seconds
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}
```

### 5. Error Handling ✅ IMPLEMENTED

```typescript
try {
  const response = await axios.get(url, { headers, params, timeout: 10000 });
  return transformResponse(response.data, query);
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      // Token invalid - clear cache and throw
      this.tokenService.clearCache();
      throw new ApiUnavailableError('Tidal authentication failed');
    }
    if (error.response?.status === 429) {
      // Rate limited
      throw new RateLimitError(retryAfter);
    }
  }
  throw new ApiUnavailableError('Search service unavailable');
}
```

---

## FUTURE ENHANCEMENTS

### Phase 1: Artist Names (PENDING)

**Goal**: Display actual artist names instead of "Unknown Artist"

**Approach**:
1. Extract artist relationship links from search results
2. Batch fetch artist data: `GET /albums/{id}/relationships/artists`
3. Parse artist names from response
4. Update cached search results with artist information

**Complexity**: Moderate
- Requires additional API calls (batching recommended)
- Response parsing for artist resources
- Cache invalidation strategy

### Phase 2: Cover Artwork (PENDING)

**Goal**: Display actual album artwork instead of placeholders

**Approach**:
1. Extract coverArt relationship links from search results
2. Batch fetch cover art: `GET /albums/{id}/relationships/coverArt`
3. Parse image URLs from response
4. Update UI with lazy-loaded images

**Complexity**: Moderate
- Additional API calls (batching critical for performance)
- Image loading/caching strategy
- Fallback handling for missing/failed images

### Phase 3: Pagination (PENDING)

**Goal**: Support browsing beyond first page of results

**Approach**:
1. Parse `links.next` and `meta.nextCursor` from response
2. Implement cursor-based pagination in GraphQL
3. Frontend "Load More" or infinite scroll
4. Cache management for paginated results

**Complexity**: Moderate
- Cursor state management
- Cache key strategy for pages
- UI pattern (button vs. infinite scroll)

---

## SECURITY CONSIDERATIONS ✅ IMPLEMENTED

### Credential Management
- ✅ Credentials stored in environment variables only
- ✅ `.env` in `.gitignore`
- ✅ `.env.example` provided without sensitive values
- ✅ Backend-only token management (never exposed to frontend)

### Input Validation
- ✅ Query validation: 1-200 characters
- ✅ Empty/whitespace rejection
- ✅ URL encoding via `encodeURIComponent()`
- ✅ GraphQL Int overflow fix (timestamp as Float)

### API Security
- ✅ HTTPS-only communication
- ✅ 10-second request timeout
- ✅ Response validation (TypeScript types)
- ✅ Structured logging for errors and API calls
- ✅ Token cache invalidation on 401 errors

---

## REFERENCES

### Official Resources
- **Developer Portal**: https://developer.tidal.com
- **API Reference**: https://developer.tidal.com/apiref
- **Quick Start Guide**: https://developer.tidal.com/documentation/api-sdk/api-sdk-quick-start
- **Authorization Docs**: https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization

### Community Resources
- **GitHub Organization**: https://github.com/orgs/tidal-music
- **API Reference (GitHub Pages)**: https://tidal-music.github.io/tidal-api-reference/
- **Discussions**: https://github.com/orgs/tidal-music/discussions

### Standards & Specifications
- **JSON:API Specification**: https://jsonapi.org/
- **OAuth 2.0 Client Credentials**: https://tools.ietf.org/html/rfc6749#section-4.4
- **ISO 8601 Duration**: https://en.wikipedia.org/wiki/ISO_8601#Durations

---

## BATCH API OPTIMIZATION STRATEGY

**Date Added**: 2025-12-28
**Status**: Planned optimization to reduce API calls from 2N to 3 total requests

### Current Approach (Inefficient)

**Problem**: For N albums, we make 2N API calls:
- N calls to `/albums/{id}?include=artists` for artist names
- N calls to `/albums/{id}/relationships/coverArt` for cover art UUIDs

**Example**: 10 albums = 20 API calls → 10 seconds at 2 req/s rate limit

### Optimized Batch Approach

**Solution**: Use Tidal's batch query capabilities to reduce to 3 total API calls:

#### Step 1: Initial Search
```
GET /v2/searchResults/{query}?include=albums,tracks&countryCode=US
```
**Returns**: Basic album and track data (no artist names, no cover art)

#### Step 2: Batch Track Details (if tracks returned)
```
GET /v2/tracks?filter[isrc]={isrc1},{isrc2},...&include=albums&countryCode=US
```
**Purpose**: Get album IDs associated with returned tracks
**Input**: Comma-separated ISRCs from Step 1 track results
**Returns**: Track details with album relationships in `included` array

**Example**:
```bash
curl 'https://openapi.tidal.com/v2/tracks?countryCode=US&include=albums&filter%5Bisrc%5D=UK5EV2200031%2CUK5EV2400023' \
  -H 'accept: application/vnd.api+json' \
  -H 'Authorization: Bearer ...'
```

**Response Structure**:
```json
{
  "data": [/* track resources with album relationships */],
  "included": [/* album resources */]
}
```

#### Step 3: Batch Album Details
```
GET /v2/albums?filter[id]={id1},{id2},...&include=artists,coverArt&countryCode=US
```
**Purpose**: Get all artist names and cover art in ONE request
**Input**: Comma-separated album IDs from Steps 1 and 2
**Returns**: Album resources with artists and coverArt in `included` array

**Example**:
```bash
curl 'https://openapi.tidal.com/v2/albums?countryCode=US&include=artists%2CcoverArt&filter%5Bid%5D=271026774%2C392171595' \
  -H 'accept: application/vnd.api+json' \
  -H 'Authorization: Bearer ...'
```

**Response Structure**:
```json
{
  "data": [
    {
      "id": "271026774",
      "type": "albums",
      "relationships": {
        "artists": {
          "data": [{"id": "3887727", "type": "artists"}]
        },
        "coverArt": {
          "data": [{"id": "2xpmpI1s9DzeL3OrxSwxpU", "type": "artworks"}]
        }
      }
    }
  ],
  "included": [
    {
      "id": "3887727",
      "type": "artists",
      "attributes": {"name": "Heartworms"}
    },
    {
      "id": "2xpmpI1s9DzeL3OrxSwxpU",
      "type": "artworks",
      "attributes": {
        "files": [
          {"href": "https://resources.tidal.com/images/.../640x640.jpg", "meta": {"height": 640, "width": 640}},
          {"href": "https://resources.tidal.com/images/.../320x320.jpg", "meta": {"height": 320, "width": 320}}
        ]
      }
    }
  ]
}
```

### Performance Comparison

| Approach | Albums | API Calls | Time @ 2 req/s | Time @ 1 req/s |
|----------|--------|-----------|----------------|----------------|
| Current  | 10     | 20 + 1    | ~10.5s         | ~21s          |
| Optimized| 10     | 3         | ~1.5s          | ~3s           |
| Current  | 20     | 40 + 1    | ~20.5s         | ~41s          |
| Optimized| 20     | 3         | ~1.5s          | ~3s           |

**Improvement**: ~85% reduction in API calls, ~7x faster response times

### Implementation Details

#### Data Flow
1. **Search** → Get album IDs + track ISRCs
2. **Extract ISRCs** from tracks (if any) → Batch tracks endpoint
3. **Collect all album IDs** from search + track results
4. **Batch albums** endpoint with `include=artists,coverArt`
5. **Parse included** array to extract:
   - Artist names from `artists` resources
   - Cover art URLs from `artworks` resources
6. **Map back** to original search results

#### Key Considerations

**URL Length Limits**:
- Most servers support ~2000 character URLs
- Album ID: ~9 chars, ISRC: ~12 chars
- Safe batch size: ~100 IDs or ~80 ISRCs per request
- For larger result sets, may need to batch in groups

**Filter Syntax**:
- `filter[id]=271026774,392171595` (comma-separated)
- URL-encoded: `filter%5Bid%5D=271026774%2C392171595`
- Similarly for `filter[isrc]`

**Response Parsing**:
```typescript
// 1. Build lookup maps
const artistMap = new Map<string, string>(); // artistId → name
const artworkMap = new Map<string, string>(); // artworkId → URL

included.forEach(resource => {
  if (resource.type === 'artists') {
    artistMap.set(resource.id, resource.attributes.name);
  }
  if (resource.type === 'artworks') {
    const url = resource.attributes.files.find(f => f.meta.width === 640)?.href;
    artworkMap.set(resource.id, url);
  }
});

// 2. Enrich album data
albums.forEach(album => {
  const artistIds = album.relationships?.artists?.data?.map(a => a.id) || [];
  album.artistNames = artistIds.map(id => artistMap.get(id) || 'Unknown');

  const artworkId = album.relationships?.coverArt?.data?.[0]?.id;
  album.artworkUrl = artworkMap.get(artworkId) || placeholderUrl;
});
```

### Rate Limiting Benefits

With batch approach:
- **Old**: 20 requests/search (hit rate limit frequently)
- **New**: 3 requests/search (rarely hit rate limit)
- Can safely use higher rate limit (3-5 req/s) without issues
- Faster user experience: ~2-3 second response time

### Migration Path

1. **Add batch fetch methods** to `tidalService.ts`:
   - `batchFetchTracks(isrcs: string[]): Promise<TrackDetails[]>`
   - `batchFetchAlbums(ids: string[], include: string): Promise<AlbumDetails[]>`

2. **Update search flow**:
   - Extract ISRCs from search results
   - Call batch endpoints sequentially (not parallel)
   - Parse `included` arrays for relationships

3. **Simplify rate limiting**:
   - Remove individual album fetch methods
   - Keep rate limiter for the 3 main requests
   - Increase default rate to 3 req/s

4. **Update types**:
   - Add `TidalTrackBatchResponse` type
   - Add `TidalAlbumBatchResponse` type
   - Add `TidalArtworkAttributes` type

### Testing Strategy

**Unit Tests**:
- Test batch URL construction (comma-separated IDs)
- Test response parsing with `included` arrays
- Test artist/artwork mapping logic

**Integration Tests**:
- Verify 3 API calls per search (not 2N+1)
- Verify artist names populated correctly
- Verify cover art URLs extracted correctly

**Edge Cases**:
- Handle albums with no artists (fallback to "Unknown")
- Handle albums with no cover art (fallback to placeholder)
- Handle tracks with no ISRC (skip batch fetch)
- Handle URL length limits (batch in groups if needed)

---

## SUMMARY

### Critical Discoveries

1. **Public API is v2**: External developers MUST use `openapi.tidal.com`, not `api.tidal.com`
2. **JSON:API Format**: Responses follow JSON:API spec, not custom JSON
3. **Relationship-Based Data**: Artist names and artwork require separate API calls
4. **Token Expiration**: 4 hours (not 1 hour as community docs suggested)
5. **ISO 8601 Durations**: Must parse format like "PT41M49S" to seconds

### Recommended Next Steps

1. **Completed** (Working MVP):
   - ✅ Basic search with placeholders
   - ✅ Token management
   - ✅ Response caching
   - ✅ Error handling
   - ✅ Rate limiting (2 req/s with retry logic)
   - ✅ Artist names and cover art (individual API calls - slow)

2. **NEXT: Batch API Optimization** (see detailed section above):
   - 🎯 Implement batch `/tracks` and `/albums` endpoints
   - 🎯 Reduce 2N+1 API calls to 3 total calls
   - 🎯 Improve response time from ~10s to ~2s
   - 🎯 Increase rate limit to 3-5 req/s safely
   - **Priority**: HIGH - Major performance improvement
   - **Effort**: Medium - Requires refactoring fetch logic
   - **Impact**: 7x faster searches, better UX

3. **Phase 2 Features**:
   - Pagination support (cursor-based)
   - Advanced search filters
   - Result sorting options

4. **Phase 3 Enhancements**:
   - Track preview playback
   - User favorites/playlists
   - Search history

### Architecture Verified

```
Frontend (React + Apollo Client)
    ↓ GraphQL Query
Backend (Node.js + Apollo Server)
    ├─ GraphQL Resolver
    ├─ Cache Service (in-memory, 1hr TTL)
    ├─ Tidal Token Service (4hr cached token)
    └─ Tidal Service (v2 API client)
        ↓ HTTPS
Tidal API v2 (openapi.tidal.com)
```

**Status**: ✅ Basic search functionality working with known limitations documented.
