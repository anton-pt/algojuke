import { gql } from '@apollo/client';

export const ADD_ALBUM_TO_LIBRARY = gql`
  mutation AddAlbumToLibrary($input: AddAlbumToLibraryInput!) {
    addAlbumToLibrary(input: $input) {
      __typename
      ... on LibraryAlbum {
        id
        tidalAlbumId
        title
        artistName
        coverArtUrl
        releaseDate
        trackCount
        trackListing {
          position
          title
          duration
          tidalId
          explicit
        }
        createdAt
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
`;

export const GET_LIBRARY_ALBUMS = gql`
  query GetLibraryAlbums {
    getLibraryAlbums {
      id
      tidalAlbumId
      title
      artistName
      coverArtUrl
      releaseDate
      trackCount
      createdAt
    }
  }
`;

export const GET_LIBRARY_ALBUM = gql`
  query GetLibraryAlbum($id: ID!) {
    getLibraryAlbum(id: $id) {
      id
      tidalAlbumId
      title
      artistName
      coverArtUrl
      releaseDate
      trackCount
      trackListing {
        position
        title
        duration
        tidalId
        explicit
        isrc
        isIndexed
      }
      createdAt
    }
  }
`;

export const REMOVE_ALBUM_FROM_LIBRARY = gql`
  mutation RemoveAlbumFromLibrary($id: ID!) {
    removeAlbumFromLibrary(id: $id)
  }
`;

export const ADD_TRACK_TO_LIBRARY = gql`
  mutation AddTrackToLibrary($input: AddTrackToLibraryInput!) {
    addTrackToLibrary(input: $input) {
      __typename
      ... on LibraryTrack {
        id
        tidalTrackId
        title
        artistName
        albumName
        duration
        coverArtUrl
        createdAt
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
`;

export const GET_LIBRARY_TRACKS = gql`
  query GetLibraryTracks {
    getLibraryTracks {
      id
      tidalTrackId
      title
      artistName
      albumName
      duration
      coverArtUrl
      createdAt
      metadata {
        isrc
      }
      isIndexed
    }
  }
`;

export const GET_LIBRARY_TRACK = gql`
  query GetLibraryTrack($id: ID!) {
    getLibraryTrack(id: $id) {
      id
      tidalTrackId
      title
      artistName
      albumName
      duration
      coverArtUrl
      createdAt
    }
  }
`;

export const REMOVE_TRACK_FROM_LIBRARY = gql`
  mutation RemoveTrackFromLibrary($id: ID!) {
    removeTrackFromLibrary(id: $id)
  }
`;
