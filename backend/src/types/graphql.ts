// TypeScript types for GraphQL responses

export interface AlbumResult {
  id: string;
  title: string;
  artist: string;
  artists: string[];
  artworkUrl: string;
  artworkThumbUrl: string;
  explicit: boolean;
  trackCount: number;
  duration: number;
  releaseDate: string;
  externalUrl: string;
  source: 'tidal';
}

export interface TrackResult {
  id: string;
  title: string;
  artist: string;
  artists: string[];
  albumTitle: string;
  albumId: string;
  artworkUrl: string;
  artworkThumbUrl: string;
  explicit: boolean;
  duration: number;
  externalUrl: string;
  source: 'tidal';
}

export interface SearchResultCounts {
  albums: number;
  tracks: number;
}

export interface SearchResults {
  albums: AlbumResult[];
  tracks: TrackResult[];
  query: string;
  total: SearchResultCounts;
  cached: boolean;
  timestamp: number;
}

export interface SearchArgs {
  query: string;
  limit?: number;
  offset?: number;
  countryCode?: string;
}
