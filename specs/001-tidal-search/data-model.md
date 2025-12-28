# Phase 1: Data Model & API Contracts

**Date**: 2025-12-27
**Feature**: Tidal Music Search Application
**Based on**: [research.md](research.md)

---

## OVERVIEW

This document defines the data structures, API contracts, and integration patterns for the Tidal Music Search application.

---

## TIDAL API DATA STRUCTURES

### Album Object (from Tidal API)

```typescript
interface TidalAlbum {
  id: string;                           // Unique Tidal album ID
  title: string;                        // Album title
  artist: TidalArtist;                  // Primary artist
  artists: TidalArtist[];               // All artists involved
  cover: string;                        // Cover image UUID (for image URL construction)
  explicit: boolean;                    // Contains explicit content
  numberOfTracks: number;               // Total tracks on album
  duration: number;                     // Total duration in seconds
  releaseDate: string;                  // ISO 8601 date (YYYY-MM-DD)
  url: string;                          // Tidal web URL
  type?: 'album';                       // Content type (for response consistency)
}
```

### Track Object (from Tidal API)

```typescript
interface TidalTrack {
  id: string;                           // Unique Tidal track ID
  title: string;                        // Track/song title
  artist: TidalArtist;                  // Primary artist
  artists?: TidalArtist[];              // All artists (featured, etc)
  album: TidalAlbumRef;                 // Album reference
  duration: number;                     // Duration in seconds
  explicit: boolean;                    // Contains explicit content
  url: string;                          // Tidal web URL
  type?: 'track';                       // Content type (for response consistency)
}
```

### Artist Object (from Tidal API)

```typescript
interface TidalArtist {
  id: string;                           // Unique Tidal artist ID
  name: string;                         // Artist name
  picture?: string;                     // Artist picture UUID (optional)
}
```

### Album Reference (Minimal Album Info)

```typescript
interface TidalAlbumRef {
  id: string;                           // Album ID
  title: string;                        // Album title
  cover: string;                        // Cover UUID for artwork
}
```

---

## TRANSFORMED DATA STRUCTURES (Backend)

These structures are used internally and returned via GraphQL API.

### Album Result (Transformed from Tidal)

```typescript
interface AlbumResult {
  id: string;                           // Tidal ID
  title: string;                        // Album title
  artist: string;                       // Primary artist name
  artists: string[];                    // All artist names
  artworkUrl: string;                   // Transformed image URL (full)
  artworkThumbUrl: string;              // Thumbnail image URL (320x320)
  explicit: boolean;
  trackCount: number;
  duration: number;                     // In seconds
  releaseDate: string;                  // ISO 8601
  externalUrl: string;                  // Link to Tidal
  source: 'tidal';                      // Data source identifier
}
```

### Track Result (Transformed from Tidal)

```typescript
interface TrackResult {
  id: string;                           // Tidal ID
  title: string;                        // Track title
  artist: string;                       // Primary artist name
  artists: string[];                    // All artist names
  albumTitle: string;                   // Album name
  albumId: string;                      // Album Tidal ID
  artworkUrl: string;                   // Album artwork (full)
  artworkThumbUrl: string;              // Album artwork (thumbnail)
  explicit: boolean;
  duration: number;                     // In seconds
  externalUrl: string;                  // Link to Tidal track
  source: 'tidal';                      // Data source identifier
}
```

### Unified Search Result

```typescript
interface SearchResults {
  albums: AlbumResult[];
  tracks: TrackResult[];
  query: string;                        // The search query used
  total: {
    albums: number;                     // Total albums matching (from Tidal)
    tracks: number;                     // Total tracks matching (from Tidal)
  };
  cached: boolean;                      // Whether result came from cache
  timestamp: number;                    // Unix timestamp when retrieved
}
```

### Error Response

```typescript
interface ApiError {
  code: string;                         // Error code (RATE_LIMIT, API_ERROR, INVALID_QUERY, etc)
  message: string;                      // User-friendly error message
  details?: string;                     // Technical details (internal use)
  retryAfter?: number;                  // Seconds to wait before retry (for rate limits)
}
```

---

## IMAGE URL GENERATION

### Artwork URL Construction

Input: Cover UUID from Tidal API
```typescript
// Example: cover = "d3e6c1f4-a2b9-4d1e-8c6f-5e4b3a2c1d0e"

function getTidalImageUrl(coverUuid: string, width: number = 320, height: number = 320, quality: number = 80): string {
  return `https://images.tidal.com/im/im?uuid=${coverUuid}&w=${width}&h=${height}&q=${quality}`;
}

// Generated URLs:
// Thumbnail: https://images.tidal.com/im/im?uuid=d3e6c1f4-...&w=320&h=320&q=80
// Full:      https://images.tidal.com/im/im?uuid=d3e6c1f4-...&w=640&h=640&q=80
```

### Image Size Standards

| Context | Width | Height | Use Case |
|---------|-------|--------|----------|
| List Item | 160 | 160 | Compact search results |
| Card Thumbnail | 320 | 320 | Standard result card |
| Detail View | 640 | 640 | Album/track detail page |
| High-res | 1280 | 1280 | Mobile retina, desktop zoom |

### Placeholder Handling

When cover UUID is missing or image fails to load:

```typescript
interface ImageMetadata {
  url: string;                          // Tidal image URL or placeholder
  placeholder: boolean;                 // True if using fallback
  width: number;
  height: number;
  type: 'album' | 'artist' | 'track';
}

// Fallback strategy:
const PLACEHOLDER_URLS = {
  album: '/images/placeholder-album.svg',
  artist: '/images/placeholder-artist.svg',
  track: '/images/placeholder-album.svg'  // Use album placeholder
};
```

---

## GraphQL SCHEMA

### Query Type

```graphql
type Query {
  """Search for albums and tracks on Tidal"""
  search(
    """Search query (1-200 characters)"""
    query: String!

    """Limit results per type (max 50)"""
    limit: Int = 20

    """Offset for pagination"""
    offset: Int = 0

    """Country code for content availability (ISO 3166-1)"""
    countryCode: String = "US"
  ): SearchResults!
}
```

### SearchResults Type

```graphql
type SearchResults {
  """Album results matching the query"""
  albums: [AlbumResult!]!

  """Track results matching the query"""
  tracks: [TrackResult!]!

  """The search query that was used"""
  query: String!

  """Total count information"""
  total: SearchResultCounts!

  """Whether this result came from cache"""
  cached: Boolean!

  """Unix timestamp when this result was retrieved"""
  timestamp: Int!
}
```

### AlbumResult Type

```graphql
type AlbumResult {
  """Unique identifier from Tidal"""
  id: String!

  """Album title"""
  title: String!

  """Primary artist name"""
  artist: String!

  """All artists involved in the album"""
  artists: [String!]!

  """Album artwork URL (standard size 320x320)"""
  artworkUrl: String!

  """Album artwork thumbnail URL (160x160)"""
  artworkThumbUrl: String!

  """Contains explicit content"""
  explicit: Boolean!

  """Number of tracks on album"""
  trackCount: Int!

  """Total duration in seconds"""
  duration: Int!

  """Release date in ISO 8601 format"""
  releaseDate: String!

  """Link to view album on Tidal"""
  externalUrl: String!

  """Data source (always 'tidal')"""
  source: String!
}
```

### TrackResult Type

```graphql
type TrackResult {
  """Unique identifier from Tidal"""
  id: String!

  """Track/song title"""
  title: String!

  """Primary artist name"""
  artist: String!

  """All artists (including featured)"""
  artists: [String!]!

  """Title of the album containing this track"""
  albumTitle: String!

  """Unique identifier of the album"""
  albumId: String!

  """Album artwork URL (standard size 320x320)"""
  artworkUrl: String!

  """Album artwork thumbnail URL (160x160)"""
  artworkThumbUrl: String!

  """Contains explicit content"""
  explicit: Boolean!

  """Track duration in seconds"""
  duration: Int!

  """Link to view track on Tidal"""
  externalUrl: String!

  """Data source (always 'tidal')"""
  source: String!
}
```

### SearchResultCounts Type

```graphql
type SearchResultCounts {
  """Total albums available matching this query on Tidal"""
  albums: Int!

  """Total tracks available matching this query on Tidal"""
  tracks: Int!
}
```

### Error Handling (GraphQL Errors)

GraphQL errors are returned in standard format:

```graphql
type Query {
  search(...): SearchResults! throws SearchError
}

enum SearchErrorCode {
  INVALID_QUERY
  RATE_LIMIT_EXCEEDED
  API_UNAVAILABLE
  INVALID_COUNTRY_CODE
}

type SearchError implements Error {
  code: SearchErrorCode!
  message: String!
  retryAfter: Int  # Seconds to wait (for RATE_LIMIT_EXCEEDED)
}
```

---

## REQUEST/RESPONSE EXAMPLES

### Example 1: Valid Search

**Request:**
```graphql
query {
  search(query: "Beatles Abbey Road", limit: 10) {
    albums {
      id
      title
      artist
      artworkThumbUrl
    }
    tracks {
      id
      title
      artist
      albumTitle
      artworkThumbUrl
    }
    total {
      albums
      tracks
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "search": {
      "albums": [
        {
          "id": "12345678",
          "title": "Abbey Road",
          "artist": "The Beatles",
          "artworkThumbUrl": "https://images.tidal.com/im/im?uuid=d3e6c1f4&w=320&h=320&q=80"
        }
      ],
      "tracks": [
        {
          "id": "67890123",
          "title": "Abbey Road",
          "artist": "The Beatles",
          "albumTitle": "Abbey Road",
          "artworkThumbUrl": "https://images.tidal.com/im/im?uuid=d3e6c1f4&w=320&h=320&q=80"
        }
      ],
      "total": {
        "albums": 5,
        "tracks": 45
      }
    }
  }
}
```

### Example 2: No Results

**Request:**
```graphql
query {
  search(query: "xyznotarealband123") {
    albums { id title }
    tracks { id title }
    total { albums tracks }
  }
}
```

**Response:**
```json
{
  "data": {
    "search": {
      "albums": [],
      "tracks": [],
      "total": {
        "albums": 0,
        "tracks": 0
      }
    }
  }
}
```

### Example 3: Special Characters

**Request:**
```graphql
query {
  search(query: "AC/DC Beyoncé") {
    albums { id title artist }
    tracks { id title artist }
  }
}
```

**Response:**
```json
{
  "data": {
    "search": {
      "albums": [
        {
          "id": "87654321",
          "title": "Back in Black",
          "artist": "AC/DC"
        },
        {
          "id": "11223344",
          "title": "Lemonade",
          "artist": "Beyoncé"
        }
      ],
      "tracks": [
        {
          "id": "99887766",
          "title": "Halo",
          "artist": "Beyoncé"
        }
      ]
    }
  }
}
```

### Example 4: Rate Limited

**Response (when rate limit exceeded):**
```json
{
  "errors": [
    {
      "message": "Too many requests. Please try again later.",
      "extensions": {
        "code": "RATE_LIMIT_EXCEEDED",
        "retryAfter": 60
      }
    }
  ]
}
```

### Example 5: API Unavailable

**Response (when Tidal API is down):**
```json
{
  "errors": [
    {
      "message": "Music search service is temporarily unavailable. Please try again in a few moments.",
      "extensions": {
        "code": "API_UNAVAILABLE"
      }
    }
  ]
}
```

---

## CACHING STRATEGY

### Cache Layers

```typescript
interface CacheConfig {
  ttl: number;                          // Time to live in seconds
  key: string;                          // Cache key format
  backend: 'memory' | 'redis';          // Storage backend
}

// Configuration:
const SEARCH_CACHE = {
  ttl: 3600,                            // 1 hour (common searches are static)
  key: `search:${query}:${countryCode}`, // Unique per query + country
  backend: 'memory'                      // In-memory for MVP (upgrade to Redis later)
};
```

### Cache Invalidation

```typescript
// Search results cached for 1 hour (content rarely changes)
// Manual invalidation: None (passive expiry only)
// Rationale: Tidal content doesn't change hourly; cache benefits outweigh staleness
```

### Cache Hit Rate Expectations

- **First search**: 0% hit rate (cache miss)
- **Common searches** (e.g., "Beatles"): 90%+ hit rate
- **Niche searches**: 5-20% hit rate
- **Overall**: 50-70% hit rate (estimate)

**Impact**: 50-70% reduction in API calls, significantly better response latency

---

## VALIDATION RULES

### Query Validation

```typescript
interface QueryValidation {
  minLength: 1;
  maxLength: 200;
  allowedCharacters: 'UTF-8';
  trimWhitespace: true;
  rejectEmptyAfterTrim: true;
}

// Examples:
validate("Beatles")           // ✅ Valid
validate("AC/DC")             // ✅ Valid
validate("Beyoncé")           // ✅ Valid
validate("北京")              // ✅ Valid
validate("")                  // ❌ Invalid (empty)
validate("   ")               // ❌ Invalid (whitespace only)
validate("a".repeat(500))     // ❌ Invalid (too long)
```

### Response Validation

```typescript
// Every Tidal API response validated for:
interface ResponseValidation {
  structure: 'matches expected schema';
  requiredFields: ['id', 'title', 'artist'];
  imageUrl: 'must be valid UUID if provided';
  duration: 'must be number >= 0';
}

// If validation fails: Return error, log incident, alert ops
```

---

## ERROR CODES & MESSAGES

### Defined Error Codes

| Code | HTTP Status | Message | Retryable |
|------|-------------|---------|-----------|
| `INVALID_QUERY` | 400 | "Search query must be 1-200 characters" | No |
| `EMPTY_QUERY` | 400 | "Please enter a search term" | No |
| `RATE_LIMIT_EXCEEDED` | 429 | "Too many requests. Try again in {retryAfter}s" | Yes |
| `API_UNAVAILABLE` | 503 | "Music service unavailable. Try again soon." | Yes |
| `API_ERROR` | 502 | "Music service error. Please try again." | Yes |
| `INVALID_COUNTRY_CODE` | 400 | "Invalid country code. Use ISO 3166-1." | No |
| `TIMEOUT` | 504 | "Search took too long. Please try again." | Yes |

---

## PERFORMANCE TARGETS

### Latency Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Cached search | <100ms | From memory cache |
| Fresh search | <2s | Including Tidal API call |
| P95 search | <3s | 95th percentile (SC-001) |
| P99 search | <5s | 99th percentile |
| Image load | <1s | Per image |

### Throughput Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Concurrent users | 100 | SC-004 |
| Requests/second | 10-20 | Based on API rate limits |
| Cache hit rate | 50%+ | Reduces API calls |
| Artwork display | 95%+ | SC-002 |

---

## API CONTRACT TESTING

### Contract Tests

These tests verify the API returns expected structure:

```typescript
// Example contract test (pseudocode)
describe('Search API Contract', () => {
  test('albums include required fields', () => {
    const response = await search('Beatles');
    const album = response.albums[0];

    expect(album).toHaveProperty('id');
    expect(album).toHaveProperty('title');
    expect(album).toHaveProperty('artist');
    expect(album).toHaveProperty('artworkThumbUrl');
    expect(album).toHaveProperty('explicit');
    expect(album).toHaveProperty('trackCount');
  });

  test('artwork URLs are valid', () => {
    const response = await search('Beatles');
    response.albums.forEach(album => {
      expect(album.artworkThumbUrl).toMatch(/^https:\/\/images\.tidal\.com/);
    });
  });

  test('response includes caching metadata', () => {
    const response = await search('Beatles');
    expect(response).toHaveProperty('cached');
    expect(response).toHaveProperty('timestamp');
  });
});
```

---

## SUMMARY

### Key Data Structures:
1. **AlbumResult**: Album with artwork URLs and metadata
2. **TrackResult**: Track with album info and artwork
3. **SearchResults**: Unified response for albums + tracks

### Important Transformations:
1. **Cover UUID → Image URLs**: Convert UUID to full image URLs
2. **Tidal Response → API Response**: Normalize and enrich data
3. **Error Handling**: Translate Tidal errors to user-friendly messages

### Cache Strategy:
1. **1-hour TTL** for search results
2. **In-memory cache** for MVP
3. **Expected 50-70% hit rate**

### Validation:
1. **Query length**: 1-200 characters
2. **UTF-8 support**: Full support for international characters
3. **Response validation**: All responses validated for schema

### Performance:
1. **Fresh search**: <3 seconds (P95)
2. **Cached search**: <100ms
3. **Artwork display**: 95%+ coverage with fallbacks
