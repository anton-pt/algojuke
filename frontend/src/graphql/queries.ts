import { gql } from '@apollo/client';

export const SEARCH_QUERY = gql`
  query Search($query: String!, $limit: Int, $offset: Int, $countryCode: String) {
    search(query: $query, limit: $limit, offset: $offset, countryCode: $countryCode) {
      albums {
        id
        title
        artist
        artists
        artworkUrl
        artworkThumbUrl
        explicit
        trackCount
        duration
        releaseDate
        externalUrl
        source
      }
      tracks {
        id
        title
        artist
        artists
        albumTitle
        albumId
        artworkUrl
        artworkThumbUrl
        explicit
        duration
        externalUrl
        source
      }
      total {
        albums
        tracks
      }
      query
      cached
      timestamp
    }
  }
`;
