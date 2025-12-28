// TypeScript types for Tidal API v2 JSON:API responses

// JSON:API base structures
export interface JsonApiResource<T = unknown> {
  id: string;
  type: string;
  attributes?: T;
  relationships?: Record<string, JsonApiRelationship>;
}

export interface JsonApiRelationship {
  data?: JsonApiResourceIdentifier | JsonApiResourceIdentifier[];
  links?: {
    self?: string;
    related?: string;
  };
}

export interface JsonApiResourceIdentifier {
  id: string;
  type: string;
}

// Album attributes from Tidal API v2
export interface TidalAlbumAttributes {
  title: string;
  explicit: boolean;
  numberOfItems: number;
  duration: string; // ISO 8601 duration format (e.g., "PT41M49S")
  releaseDate: string; // ISO 8601 date
  popularity?: number;
  externalLinks?: Array<{
    href: string;
    meta?: { type: string };
  }>;
  barcodeId?: string;
  copyright?: {
    text: string;
  };
}

// Track attributes from Tidal API v2
export interface TidalTrackAttributes {
  title: string;
  explicit: boolean;
  duration: string; // ISO 8601 duration format
  popularity?: number;
  externalLinks?: Array<{
    href: string;
    meta?: { type: string };
  }>;
  isrc?: string;
}

// Artist attributes from Tidal API v2
export interface TidalArtistAttributes {
  name: string;
  popularity?: number;
  externalLinks?: Array<{
    href: string;
    meta?: { type: string };
  }>;
}

// Search results response from v2 API
export interface TidalV2SearchResponse {
  data: JsonApiResource<{
    trackingId: string;
  }> & {
    relationships: {
      albums?: {
        data: JsonApiResourceIdentifier[];
        links?: {
          self: string;
          next?: string;
          meta?: {
            total?: number;
            nextCursor?: string;
          };
        };
      };
      tracks?: {
        data?: JsonApiResourceIdentifier[];
        links?: {
          self: string;
          next?: string;
          meta?: {
            total?: number;
            nextCursor?: string;
          };
        };
      };
      artists?: {
        data?: JsonApiResourceIdentifier[];
        links?: {
          self: string;
        };
      };
    };
  };
  included?: Array<
    | JsonApiResource<TidalAlbumAttributes>
    | JsonApiResource<TidalTrackAttributes>
    | JsonApiResource<TidalArtistAttributes>
  >;
  links?: {
    self: string;
  };
}

export interface TidalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Album details response (single album with relationships)
export interface TidalAlbumDetailsResponse {
  data: JsonApiResource<TidalAlbumAttributes>;
  included?: Array<
    | JsonApiResource<TidalArtistAttributes>
    | JsonApiResource<TidalAlbumAttributes>
  >;
  links?: {
    self: string;
  };
}

// Cover art attributes from Tidal API v2
export interface TidalCoverArtAttributes {
  url: string;
  width: number;
  height: number;
}

// Cover art relationship response
export interface TidalCoverArtResponse {
  data: JsonApiResource<TidalCoverArtAttributes>[];
  links?: {
    self: string;
  };
}

// Artwork attributes from Tidal API v2 (for batch queries)
export interface TidalArtworkAttributes {
  files: Array<{
    href: string;
    meta: {
      width: number;
      height: number;
    };
  }>;
}

// Batch track query response
export interface TidalTrackBatchResponse {
  data: JsonApiResource<TidalTrackAttributes>[];
  included?: Array<
    | JsonApiResource<TidalAlbumAttributes>
    | JsonApiResource<TidalArtistAttributes>
  >;
  links?: {
    self: string;
  };
}

// Batch album query response
export interface TidalAlbumBatchResponse {
  data: JsonApiResource<TidalAlbumAttributes>[];
  included?: Array<
    | JsonApiResource<TidalArtistAttributes>
    | JsonApiResource<TidalArtworkAttributes>
  >;
  links?: {
    self: string;
  };
}
