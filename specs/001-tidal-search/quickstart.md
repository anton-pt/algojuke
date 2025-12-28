# Phase 1: Quick Start Implementation Guide

**Date**: 2025-12-27
**Feature**: Tidal Music Search Application
**Purpose**: Reference guide for developers implementing search functionality

---

## QUICK REFERENCE

### Tidal API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/search` | GET | Search albums + tracks | OAuth2 |
| `/albums/search` | GET | Search albums only | OAuth2 |
| `/tracks/search` | GET | Search tracks only | OAuth2 |

### Image URL Pattern

```
https://images.tidal.com/im/im?uuid=COVER_UUID&w=WIDTH&h=HEIGHT&q=QUALITY
```

**Common Sizes:**
- List: `w=160&h=160`
- Card: `w=320&h=320`
- Detail: `w=640&h=640`

### Environment Variables

```bash
TIDAL_CLIENT_ID=your_client_id
TIDAL_CLIENT_SECRET=your_client_secret
TIDAL_TOKEN_URL=https://login.tidal.com/oauth2/token
TIDAL_API_BASE_URL=https://api.tidal.com/v1
SEARCH_CACHE_TTL=3600
```

---

## BACKEND IMPLEMENTATION OUTLINE

### 1. Token Management Service

```typescript
// services/tidalTokenService.ts

class TidalTokenService {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  async getValidToken(): Promise<string> {
    // If cached token still valid, return it
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.token;
    }

    // Otherwise, fetch new token
    const token = await this.fetchNewToken();
    this.cachedToken = {
      token,
      expiresAt: Date.now() + 3600000 // 1 hour
    };
    return token;
  }

  private async fetchNewToken(): Promise<string> {
    const response = await fetch(process.env.TIDAL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.TIDAL_CLIENT_ID!,
        client_secret: process.env.TIDAL_CLIENT_SECRET!
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get Tidal token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }
}
```

### 2. Tidal API Service

```typescript
// services/tidalService.ts

class TidalService {
  constructor(private tokenService: TidalTokenService) {}

  async search(query: string, types = 'albums,tracks', limit = 20): Promise<SearchResults> {
    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error('EMPTY_QUERY');
    }
    if (query.length > 200) {
      throw new Error('INVALID_QUERY');
    }

    const token = await this.tokenService.getValidToken();

    const url = `${process.env.TIDAL_API_BASE_URL}/search?` +
      `query=${encodeURIComponent(query.trim())}&` +
      `types=${types}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tidal-Token': process.env.TIDAL_CLIENT_ID!
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      throw new Error('API_ERROR');
    }

    const data = await response.json();
    return this.transformResponse(data);
  }

  private transformResponse(tidalResponse: any): SearchResults {
    return {
      albums: (tidalResponse.albums?.items || []).map(album => ({
        id: album.id,
        title: album.title,
        artist: album.artist?.name || '',
        artists: album.artists?.map((a: any) => a.name) || [],
        artworkUrl: this.buildImageUrl(album.cover, 640),
        artworkThumbUrl: this.buildImageUrl(album.cover, 320),
        explicit: album.explicit || false,
        trackCount: album.numberOfTracks || 0,
        duration: album.duration || 0,
        releaseDate: album.releaseDate || '',
        externalUrl: album.url || '',
        source: 'tidal'
      })),
      tracks: (tidalResponse.tracks?.items || []).map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist?.name || '',
        artists: track.artists?.map((a: any) => a.name) || [],
        albumTitle: track.album?.title || '',
        albumId: track.album?.id || '',
        artworkUrl: this.buildImageUrl(track.album?.cover, 640),
        artworkThumbUrl: this.buildImageUrl(track.album?.cover, 320),
        explicit: track.explicit || false,
        duration: track.duration || 0,
        externalUrl: track.url || '',
        source: 'tidal'
      })),
      query: tidalResponse.albums?.items?.[0] ? 'search' : '',
      total: {
        albums: tidalResponse.albums?.totalNumberOfItems || 0,
        tracks: tidalResponse.tracks?.totalNumberOfItems || 0
      },
      cached: false,
      timestamp: Date.now()
    };
  }

  private buildImageUrl(coverUuid: string | null, size: number = 320): string {
    if (!coverUuid) {
      return '/images/placeholder-album.svg'; // Fallback
    }
    return `https://images.tidal.com/im/im?uuid=${coverUuid}&w=${size}&h=${size}&q=80`;
  }
}
```

### 3. Cache Layer

```typescript
// services/cacheService.ts

class CacheService {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  set(key: string, data: any, ttl: number = 3600): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl * 1000
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 4. GraphQL Resolver

```typescript
// resolvers/searchResolver.ts

const searchResolver = {
  async search(_: any, args: any, context: any) {
    const { query, limit = 20, offset = 0, countryCode = 'US' } = args;

    // Check cache first
    const cacheKey = `search:${query}:${countryCode}`;
    let results = context.cache.get(cacheKey);

    if (results) {
      results.cached = true;
      return results;
    }

    try {
      // Fetch from Tidal API
      results = await context.tidalService.search(query, 'albums,tracks', limit);

      // Cache the results
      context.cache.set(cacheKey, results, process.env.SEARCH_CACHE_TTL || 3600);

      results.cached = false;
      return results;
    } catch (error) {
      // Handle errors
      if (error.message === 'EMPTY_QUERY') {
        throw new Error('Search query must be provided');
      }
      if (error.message === 'INVALID_QUERY') {
        throw new Error('Search query must be 1-200 characters');
      }
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        throw new Error('Too many requests. Please try again later.');
      }
      throw new Error('Music search service is temporarily unavailable');
    }
  }
};
```

---

## FRONTEND IMPLEMENTATION OUTLINE

### 1. GraphQL Query

```typescript
// graphql/queries.ts

import { gql } from '@apollo/client';

export const SEARCH_QUERY = gql`
  query Search($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      albums {
        id
        title
        artist
        artworkThumbUrl
        trackCount
        releaseDate
        externalUrl
      }
      tracks {
        id
        title
        artist
        albumTitle
        artworkThumbUrl
        externalUrl
      }
      total {
        albums
        tracks
      }
      cached
      timestamp
    }
  }
`;
```

### 2. Search Component

```typescript
// components/SearchBar.tsx

import React, { useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { SEARCH_QUERY } from '../graphql/queries';

export function SearchBar({ onResults }: { onResults: (results: any) => void }) {
  const [query, setQuery] = useState('');
  const [search, { loading, error }] = useLazyQuery(SEARCH_QUERY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      alert('Please enter a search term');
      return;
    }

    try {
      const { data } = await search({ variables: { query: query.trim(), limit: 20 } });
      onResults(data.search);
    } catch (err) {
      console.error('Search error:', err);
      alert('Search failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search albums and tracks..."
        maxLength={200}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

### 3. Results Display Component

```typescript
// components/ResultsList.tsx

import React from 'react';
import { AlbumCard } from './AlbumCard';
import { TrackCard } from './TrackCard';

export function ResultsList({ results }: { results: any }) {
  if (!results) return null;

  const { albums, tracks, total, cached } = results;

  return (
    <div className="results">
      <div className="metadata">
        {cached && <span className="badge">Cached</span>}
        <p>Found {total.albums} albums and {total.tracks} tracks</p>
      </div>

      {albums.length === 0 && tracks.length === 0 ? (
        <div className="no-results">
          <p>No results found. Try different search terms.</p>
        </div>
      ) : (
        <>
          {albums.length > 0 && (
            <section className="albums">
              <h2>Albums ({total.albums})</h2>
              <div className="grid">
                {albums.map(album => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </section>
          )}

          {tracks.length > 0 && (
            <section className="tracks">
              <h2>Tracks ({total.tracks})</h2>
              <div className="list">
                {tracks.map(track => (
                  <TrackCard key={track.id} track={track} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

### 4. Album Card Component

```typescript
// components/AlbumCard.tsx

import React, { useState } from 'react';

export function AlbumCard({ album }: { album: any }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="album-card">
      <div className="artwork">
        <img
          src={imageError ? '/images/placeholder-album.svg' : album.artworkThumbUrl}
          alt={album.title}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
      <div className="info">
        <h3>{album.title}</h3>
        <p className="artist">{album.artist}</p>
        <p className="meta">{album.trackCount} tracks • {album.releaseDate}</p>
        <a href={album.externalUrl} target="_blank" rel="noopener noreferrer">
          View on Tidal
        </a>
      </div>
    </div>
  );
}
```

---

## TESTING QUICK REFERENCE

### Backend Tests Structure

```
tests/
├── unit/
│   ├── tidalService.test.ts      # Service logic
│   ├── cacheService.test.ts      # Caching behavior
│   └── validators.test.ts        # Input validation
├── integration/
│   └── search.integration.test.ts # Full search flow
└── contract/
    └── searchSchema.test.ts      # GraphQL schema
```

### Example Unit Test

```typescript
// tests/unit/tidalService.test.ts

describe('TidalService', () => {
  it('should transform album response correctly', () => {
    const service = new TidalService(mockTokenService);
    const tidalResponse = {
      albums: {
        items: [
          {
            id: '123',
            title: 'Abbey Road',
            artist: { name: 'The Beatles' },
            cover: 'abc123'
          }
        ]
      }
    };

    const result = service.transformResponse(tidalResponse);

    expect(result.albums[0]).toEqual({
      id: '123',
      title: 'Abbey Road',
      artist: 'The Beatles',
      artworkThumbUrl: expect.stringContaining('images.tidal.com')
    });
  });
});
```

---

## DEPLOYMENT CHECKLIST

### Before Going Live

- [ ] Environment variables set in production
- [ ] Tidal API credentials rotated and secured
- [ ] Rate limiting configured (start conservative: 5 req/sec)
- [ ] Caching enabled with 1-hour TTL
- [ ] Error handling tested for all edge cases
- [ ] Placeholder images created and deployed
- [ ] Logging configured for API interactions
- [ ] Monitoring set up for API errors
- [ ] Load testing completed (100 concurrent users)
- [ ] Security review completed

### Production Considerations

```typescript
// Example monitoring code
function logSearch(query: string, resultCount: number, cached: boolean) {
  logger.info('search_executed', {
    query,
    resultCount,
    cached,
    timestamp: new Date().toISOString()
  });
}

function logError(error: Error, context: string) {
  logger.error('search_error', {
    error: error.message,
    context,
    timestamp: new Date().toISOString()
  });
}
```

---

## COMMON IMPLEMENTATION ISSUES & SOLUTIONS

### Issue 1: "401 Unauthorized" from Tidal API

**Cause**: Invalid or expired token

**Solution**:
```typescript
// Implement token refresh before expiry
if (this.cachedToken.expiresAt < Date.now() + 5 * 60000) { // 5 min buffer
  this.cachedToken = null; // Force refresh
}
```

### Issue 2: Missing Album Artwork

**Cause**: cover UUID is null or image URL fails

**Solution**:
```typescript
// Always use fallback for missing cover
artworkThumbUrl: cover
  ? `https://images.tidal.com/im/im?uuid=${cover}&w=320&h=320`
  : '/images/placeholder-album.svg'
```

### Issue 3: Search Timeout

**Cause**: Tidal API slow or unresponsive

**Solution**:
```typescript
// Set reasonable timeout
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10 sec
const response = await fetch(url, { signal: controller.signal });
```

### Issue 4: Rate Limit Exceeded

**Cause**: Too many requests to Tidal API

**Solution**:
```typescript
// Implement caching and queue
const cacheKey = `search:${query}:${countryCode}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey); // Return cached
}
// If cache miss, add to request queue with rate limiting
```

---

## QUICK DEBUGGING

### Verify Tidal API Access

```bash
# Get token
curl -X POST https://login.tidal.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET"

# Test search with token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.tidal.com/v1/search?query=Beatles&types=albums,tracks&limit=5"

# Test image URL
curl -I "https://images.tidal.com/im/im?uuid=abc123&w=320&h=320"
```

### Enable Debug Logging

```typescript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  logger.debug('Search request', { query, limit, offset });
  logger.debug('Tidal response', { albums, tracks });
  logger.debug('Cache status', { cached, ttl });
}
```

---

## NEXT STEPS

1. **Set up backend project structure** (use plan.md for details)
2. **Implement token service** (see Backend Implementation section)
3. **Implement Tidal API service** (with error handling)
4. **Set up GraphQL schema** (see data-model.md)
5. **Create React components** (SearchBar, ResultsList, cards)
6. **Add caching layer** (in-memory for MVP)
7. **Write tests** (unit, integration, contract)
8. **Deploy and monitor** (see Deployment Checklist)

---

## REFERENCES

- Full Research: [research.md](research.md)
- Data Model: [data-model.md](data-model.md)
- Implementation Plan: [plan.md](plan.md)
- Feature Spec: [spec.md](spec.md)
